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

// Serve the configured message template image publicly as a JPEG/PNG asset
app.get(['/api/template-image', '/api/template-image.jpg'], async (req, res) => {
  try {
    let data = readLocalStorage();
    let imageBase64 = data?.settings?.messageTemplateImage;

    // If not in local storage yet, check Firestore (both app_settings and app_state)
    if ((!imageBase64 || typeof imageBase64 !== 'string') && db) {
      try {
        const settingsDocRef = doc(db, 'app_settings', 'main_settings');
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          imageBase64 = settingsData?.settings?.messageTemplateImage;
        }

        if (!imageBase64) {
          const docRef = doc(db, 'app_state', APP_STATE_DOC_ID);
          const snapshot = await getDoc(docRef);
          if (snapshot.exists()) {
            const cloudData = snapshot.data();
            imageBase64 = cloudData?.settings?.messageTemplateImage;
            if (imageBase64) {
              writeLocalStorage(cloudData);
            }
          }
        }
      } catch {}
    }

    if (!imageBase64 || typeof imageBase64 !== 'string' || !imageBase64.includes(',')) {
      return res.status(404).send('Nenhuma imagem configurada no momento.');
    }

    const parts = imageBase64.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const buffer = Buffer.from(parts[1], 'base64');

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).send('Erro ao carregar imagem.');
  }
});

// Dedicated endpoint to upload and store message template image reliably
app.post('/api/upload-template-image', async (req, res) => {
  try {
    const { image, name } = req.body;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, error: 'Imagem inválida' });
    }
    const currentData = readLocalStorage() || {};
    currentData.settings = {
      ...(currentData.settings || {}),
      messageTemplateImage: image,
      messageTemplateImageName: name || 'aviso_cobranca.jpg',
      messageSendMode: currentData.settings?.messageSendMode === 'text_only' ? 'image_and_text' : (currentData.settings?.messageSendMode || 'image_and_text'),
    };
    writeLocalStorage(currentData);

    if (db) {
      try {
        const settingsRef = doc(db, 'app_settings', 'main_settings');
        await setDoc(settingsRef, {
          settings: currentData.settings,
          updatedAt: Date.now(),
        }, { merge: true });
      } catch {}
    }

    return res.json({ success: true, settings: currentData.settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Erro ao salvar imagem' });
  }
});

// Dedicated OpenGraph public page for WhatsApp link previews and direct visual notice
app.get(['/aviso', '/aviso/:id'], (req, res) => {
  try {
    const data = readLocalStorage();
    const settings = data?.settings || {};
    const companyName = settings.name || 'MrGestor';
    const pixKey = settings.pixKey || '';
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const hostUrl = `${proto}://${host}`;
    const imageUrl = `${hostUrl}/api/template-image.jpg`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aviso de Vencimento - ${companyName}</title>
  <meta property="og:title" content="Aviso de Vencimento - ${companyName}" />
  <meta property="og:description" content="Confira os dados do seu aviso e chave PIX para pagamento." />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:secure_url" content="${imageUrl}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${imageUrl}" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex flex-col items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
    <div class="space-y-1">
      <span class="text-[11px] uppercase tracking-wider text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-3 py-1 rounded-full inline-block">
        ${companyName}
      </span>
      <h1 class="text-xl font-bold text-white mt-2">Aviso de Vencimento</h1>
      <p class="text-xs text-slate-400">Consulte o informativo visual abaixo:</p>
    </div>

    <div class="rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-inner">
      <img src="${imageUrl}" alt="Aviso" class="w-full h-auto object-contain max-h-[70vh]" onerror="this.parentElement.innerHTML='<div class=\\'p-8 text-xs text-slate-400\\'>Imagem não disponível ou em atualização.</div>'" />
    </div>

    ${pixKey ? `
    <div class="p-3.5 bg-slate-900/80 border border-slate-700/80 rounded-2xl text-left space-y-1.5">
      <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Chave PIX para Pagamento:</p>
      <div class="flex items-center justify-between gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
        <code class="text-xs text-emerald-400 font-mono select-all break-all">${pixKey}</code>
      </div>
    </div>` : ''}

    <div class="pt-2 flex flex-col gap-2">
      <a href="${imageUrl}" download="aviso_cobranca.jpg" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
        Baixar Imagem do Aviso
      </a>
      <p class="text-[10px] text-slate-500">${companyName} • Gestão Financeira Segura</p>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    return res.status(500).send('Erro ao abrir aviso.');
  }
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
    console.warn('POST /api/data handled warning:', err?.message);
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
