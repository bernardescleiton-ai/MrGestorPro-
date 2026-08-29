import express from 'express';
import path from 'path';
import fs from 'fs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
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

// Load Firebase configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let db: any = null;
let firestoreCooldownUntil = 0;

if (fs.existsSync(configPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    db = null;
  }
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
      return JSON.parse(content);
    } catch {
      // Ignored
    }
  }
  return null;
}

function writeLocalStorage(data: any) {
  ensureDataDir();
  const tempFile = `${DATA_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch {
    // Write fallback
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

const APP_STATE_DOC_ID = 'main_state';

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/data', async (req, res) => {
  try {
    const now = Date.now();
    const canUseFirestore = db && now > firestoreCooldownUntil;

    if (canUseFirestore) {
      try {
        const docRef = doc(db, 'app_state', APP_STATE_DOC_ID);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          writeLocalStorage(cloudData);
          return res.json({ success: true, data: cloudData, exists: true });
        }
      } catch (dbErr: any) {
        // Quota exceeded or network issue -> activate 15-minute circuit breaker
        firestoreCooldownUntil = now + 15 * 60 * 1000;
      }
    }

    const localData = readLocalStorage();
    return res.json({ success: true, data: localData, exists: !!localData });
  } catch (err: any) {
    const fallbackData = readLocalStorage();
    res.json({ success: true, data: fallbackData, exists: !!fallbackData });
  }
});

app.post('/api/data', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const currentLocal = readLocalStorage();
    const sanitizedData = sanitizeDataForFirestore({
      clients: Array.isArray(payload.clients) ? payload.clients : (currentLocal?.clients || []),
      charges: Array.isArray(payload.charges) ? payload.charges : (currentLocal?.charges || []),
      settings: payload.settings || currentLocal?.settings || {},
      sentLogs: Array.isArray(payload.sentLogs) ? payload.sentLogs : (currentLocal?.sentLogs || []),
      updatedAt: typeof payload.updatedAt === 'number' && payload.updatedAt > 0 ? payload.updatedAt : Date.now(),
    });

    // Write to server local disk
    writeLocalStorage(sanitizedData);

    const now = Date.now();
    const canUseFirestore = db && now > firestoreCooldownUntil;

    if (canUseFirestore) {
      try {
        const docRef = doc(db, 'app_state', APP_STATE_DOC_ID);
        await setDoc(docRef, sanitizedData, { merge: true });
      } catch {
        firestoreCooldownUntil = now + 15 * 60 * 1000;
      }
    }

    res.json({ success: true, data: sanitizedData, updatedAt: sanitizedData.updatedAt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
});

app.get('/api/backup/download', async (req, res) => {
  try {
    const data = readLocalStorage();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=mrgestor_backup_${Date.now()}.json`);
    res.send(JSON.stringify(data || {}, null, 2));
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

async function startServer() {
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
