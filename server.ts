import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// Initialize Firebase in server
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const fApp = getApps().length === 0
      ? initializeApp({
          apiKey: firebaseConfig.apiKey,
          authDomain: firebaseConfig.authDomain,
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
          messagingSenderId: firebaseConfig.messagingSenderId,
          appId: firebaseConfig.appId,
        })
      : getApp();
    db = getFirestore(fApp, firebaseConfig.firestoreDatabaseId);
    console.log('[SERVER] Firestore initialized successfully with db:', firebaseConfig.firestoreDatabaseId);
  }
} catch (e) {
  console.error('[SERVER] Firestore initialization error:', e);
}

// Local storage setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'app_storage.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLocalStorage() {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      if (content && content.trim()) {
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Error reading app_storage.json:', e);
    }
  }
  return null;
}

function writeLocalStorage(data: any): boolean {
  ensureDataDir();
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(DATA_FILE, jsonStr, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write app_storage.json:', err);
    return false;
  }
}

function sanitizeDataForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDataForFirestore);
  }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        sanitized[key] = sanitizeDataForFirestore(val);
      }
    }
    return sanitized;
  }
  return obj;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/data', async (req, res) => {
  try {
    const localData = readLocalStorage();
    if (localData && Array.isArray(localData.clients) && localData.clients.length > 0) {
      return res.json({ success: true, data: localData, exists: true });
    }

    // If local disk is empty or missing (e.g. fresh Cloud Run instance), load from Firestore!
    if (db) {
      try {
        const docRef = doc(db, 'app_state', 'main_state');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const cloudData = snap.data();
          if (cloudData && Array.isArray(cloudData.clients) && cloudData.clients.length > 0) {
            writeLocalStorage(cloudData);
            return res.json({ success: true, data: cloudData, exists: true });
          }
        }
      } catch (dbErr: any) {
        console.warn('[SERVER] Firestore fetch warning:', dbErr?.message);
      }
    }

    return res.json({ success: true, data: localData, exists: !!localData });
  } catch (err: any) {
    console.error('GET /api/data error:', err);
    res.json({ success: false, data: null, exists: false, error: err?.message });
  }
});

app.post('/api/data', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const currentLocal = readLocalStorage() || { clients: [], charges: [], settings: {}, sentLogs: [] };

    // Safety guard: if current storage has clients, and incoming payload has 0 clients,
    // do not wipe out all clients unless forceEmpty: true was explicitly sent
    let incomingClients = Array.isArray(payload.clients) ? payload.clients : (currentLocal.clients || []);
    if (incomingClients.length === 0 && Array.isArray(currentLocal.clients) && currentLocal.clients.length > 0 && !payload.forceEmpty) {
      console.warn(`[STORAGE GUARD] Prevented overwriting ${currentLocal.clients.length} existing clients with 0 clients! Preserving existing clients.`);
      incomingClients = currentLocal.clients;
    }

    const sanitizedData = sanitizeDataForFirestore({
      clients: incomingClients,
      charges: Array.isArray(payload.charges) ? payload.charges : (currentLocal?.charges || []),
      settings: payload.settings && typeof payload.settings === 'object' ? payload.settings : (currentLocal?.settings || {}),
      sentLogs: Array.isArray(payload.sentLogs) ? payload.sentLogs : (currentLocal?.sentLogs || []),
      updatedAt: typeof payload.updatedAt === 'number' && payload.updatedAt > 0 ? payload.updatedAt : Date.now(),
    });

    // 1. Write to local server disk cache
    writeLocalStorage(sanitizedData);

    // 2. Persist to Firestore master database
    if (db) {
      try {
        const docRef = doc(db, 'app_state', 'main_state');
        await setDoc(docRef, sanitizedData);
      } catch (dbErr: any) {
        console.warn('[SERVER] Firestore save warning:', dbErr?.message);
      }
    }

    res.json({ success: true, data: sanitizedData, updatedAt: sanitizedData.updatedAt });
  } catch (err: any) {
    console.error('POST /api/data error:', err);
    const fallback = readLocalStorage() || {};
    res.json({ success: true, data: fallback, warning: err?.message || 'Handled with fallback' });
  }
});

app.get('/api/backup/download', async (req, res) => {
  try {
    const data = readLocalStorage() || {};
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=mrgestor_backup_${Date.now()}.json`);
    res.send(JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.warn('Backup download handled warning:', err?.message);
    res.json({ success: false, error: err?.message });
  }
});

// Global Express error handler to prevent unhandled 500 crashes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express global error caught:', err);
  if (!res.headersSent) {
    res.status(200).json({ success: false, error: err?.message || 'Handled safely' });
  }
});

// Process-level crash prevention (Critical for Cloud Run and APK WebViews)
process.on('uncaughtException', (err) => {
  console.error('Server process uncaughtException handled:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Server process unhandledRejection handled:', reason);
});

// Daily 00:00 automatic restore point background scheduler
function initMidnightRestoreScheduler() {
  const runMidnightSnapshot = async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const data = readLocalStorage();
      if (!data || (!data.clients?.length && !data.charges?.length)) return;

      const dateBR = now.toLocaleDateString('pt-BR');
      const pointId = `rp_auto_${todayStr.replace(/-/g, '_')}_0000`;
      const restorePoint = {
        id: pointId,
        name: `Ponto Automático Diário (00:00) - ${dateBR}`,
        createdAt: now.toISOString(),
        clientsCount: data.clients?.length || 0,
        chargesCount: data.charges?.length || 0,
        data: {
          clients: data.clients || [],
          charges: data.charges || [],
          settings: data.settings || {},
        },
      };

      if (db && Date.now() > firestoreCooldownUntil) {
        try {
          const pointRef = doc(db, 'restore_points', pointId);
          const { id: _id, ...rest } = restorePoint;
          await setDoc(pointRef, sanitizeDataForFirestore(rest), { merge: true });
          console.log(`[Server Scheduler] Daily 00:00 restore point synced to Firestore: ${pointId}`);
        } catch (dbErr: any) {
          const msg = String(dbErr?.message || dbErr);
          if (msg.includes('resource-exhausted') || msg.includes('Quota exceeded') || dbErr?.code === 'resource-exhausted') {
            firestoreCooldownUntil = Date.now() + 24 * 60 * 60 * 1000;
          } else {
            firestoreCooldownUntil = Date.now() + 15 * 60 * 1000;
          }
        }
      }
    } catch (err) {
      console.warn('[Server Scheduler] Midnight snapshot notice:', err);
    }
  };

  const scheduleNextMidnight = () => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    setTimeout(() => {
      runMidnightSnapshot();
      scheduleNextMidnight();
    }, msUntilMidnight);
  };

  scheduleNextMidnight();
}

async function startServer() {
  initMidnightRestoreScheduler();
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MrGestor Full-Stack Server running on port ${PORT}`);
  });
}

startServer();
