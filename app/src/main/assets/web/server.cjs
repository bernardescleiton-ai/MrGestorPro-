var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_vite = require("vite");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "20mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "20mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
var db = null;
var firestoreCooldownUntil = 0;
if (import_fs.default.existsSync(configPath)) {
  try {
    const firebaseConfig = JSON.parse(import_fs.default.readFileSync(configPath, "utf-8"));
    const firebaseApp = (0, import_app.getApps)().length === 0 ? (0, import_app.initializeApp)(firebaseConfig) : (0, import_app.getApp)();
    db = (0, import_firestore.getFirestore)(firebaseApp, firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    db = null;
  }
}
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var DATA_FILE = import_path.default.join(DATA_DIR, "app_storage.json");
function ensureDataDir() {
  if (!import_fs.default.existsSync(DATA_DIR)) {
    import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
  }
}
function readLocalStorage() {
  ensureDataDir();
  if (import_fs.default.existsSync(DATA_FILE)) {
    try {
      const content = import_fs.default.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(content);
    } catch {
    }
  }
  return null;
}
function writeLocalStorage(data) {
  ensureDataDir();
  const tempFile = `${DATA_FILE}.tmp`;
  try {
    import_fs.default.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
    import_fs.default.renameSync(tempFile, DATA_FILE);
  } catch {
  }
}
function sanitizeDataForFirestore(obj) {
  if (obj === null || obj === void 0) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDataForFirestore);
  }
  if (typeof obj === "object") {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== void 0) {
        sanitized[key] = sanitizeDataForFirestore(val);
      }
    }
    return sanitized;
  }
  return obj;
}
var APP_STATE_DOC_ID = "main_state";
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});
app.get("/api/data", async (req, res) => {
  try {
    const now = Date.now();
    const canUseFirestore = db && now > firestoreCooldownUntil;
    if (canUseFirestore) {
      try {
        const docRef = (0, import_firestore.doc)(db, "app_state", APP_STATE_DOC_ID);
        const snapshot = await (0, import_firestore.getDoc)(docRef);
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          writeLocalStorage(cloudData);
          return res.json({ success: true, data: cloudData, exists: true });
        }
      } catch (dbErr) {
        firestoreCooldownUntil = now + 15 * 60 * 1e3;
      }
    }
    const localData = readLocalStorage();
    return res.json({ success: true, data: localData, exists: !!localData });
  } catch (err) {
    const fallbackData = readLocalStorage();
    res.json({ success: true, data: fallbackData, exists: !!fallbackData });
  }
});
app.post("/api/data", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ success: false, error: "Invalid payload" });
    }
    const currentLocal = readLocalStorage();
    const sanitizedData = sanitizeDataForFirestore({
      clients: Array.isArray(payload.clients) ? payload.clients : currentLocal?.clients || [],
      charges: Array.isArray(payload.charges) ? payload.charges : currentLocal?.charges || [],
      settings: payload.settings || currentLocal?.settings || {},
      sentLogs: Array.isArray(payload.sentLogs) ? payload.sentLogs : currentLocal?.sentLogs || [],
      updatedAt: typeof payload.updatedAt === "number" && payload.updatedAt > 0 ? payload.updatedAt : Date.now()
    });
    writeLocalStorage(sanitizedData);
    const now = Date.now();
    const canUseFirestore = db && now > firestoreCooldownUntil;
    if (canUseFirestore) {
      try {
        const docRef = (0, import_firestore.doc)(db, "app_state", APP_STATE_DOC_ID);
        await (0, import_firestore.setDoc)(docRef, sanitizedData, { merge: true });
      } catch {
        firestoreCooldownUntil = now + 15 * 60 * 1e3;
      }
    }
    res.json({ success: true, data: sanitizedData, updatedAt: sanitizedData.updatedAt });
  } catch (err) {
    console.warn("POST /api/data handled warning:", err?.message);
    const fallback = readLocalStorage() || {};
    res.json({ success: true, data: fallback, warning: err?.message || "Handled with fallback" });
  }
});
app.get("/api/backup/download", async (req, res) => {
  try {
    const data = readLocalStorage() || {};
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=mrgestor_backup_${Date.now()}.json`);
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn("Backup download handled warning:", err?.message);
    res.json({ success: false, error: err?.message });
  }
});
app.use((err, req, res, next) => {
  console.error("Express global error caught:", err);
  if (!res.headersSent) {
    res.status(200).json({ success: false, error: err?.message || "Handled safely" });
  }
});
process.on("uncaughtException", (err) => {
  console.error("Server process uncaughtException handled:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Server process unhandledRejection handled:", reason);
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true, host: "0.0.0.0", port: 3e3 },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MrGestor Full-Stack Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
