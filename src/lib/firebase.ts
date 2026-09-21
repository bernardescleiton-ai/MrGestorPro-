import { initializeApp, getApps, getApp, setLogLevel as setAppLogLevel } from 'firebase/app';
import {
  getFirestore, 
  doc, 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch,
  enableNetwork,
  deleteField,
  enableIndexedDbPersistence,
  getDocFromServer,
  setLogLevel as setFirestoreLogLevel
} from 'firebase/firestore';
import { AppData, Client, Charge, SentMessageLog, CompanySettings, SystemRestorePoint } from '../types';
import { initialAppData } from '../data/initialData';
import firebaseConfigFile from '../../firebase-applet-config.json';

import { logger } from './logger';
// Mute internal Firebase SDK backoff logs
try {
  setAppLogLevel('silent');
  setFirestoreLogLevel('silent');
} catch {}

let isQuotaExhausted = false;

export function markQuotaExhausted() {
  if (!isQuotaExhausted) {
    isQuotaExhausted = true;
    try {
      setAppLogLevel('silent');
      setFirestoreLogLevel('silent');
    } catch {}
    logger.info('Firestore daily write/read quota reached. Switched to local device persistence mode.');
  }
}

export function getIsQuotaExhausted(): boolean {
  return isQuotaExhausted;
}

const hardcodedConfig = {
  projectId: "inspired-anchor-477400-s4",
  appId: "1:33184185661:web:53cd890343c27624e95954",
  apiKey: "AIzaSyDJaPyi0aLwr54V3dIX8yJU1ddJqNSlM58",
  authDomain: "inspired-anchor-477400-s4.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-gestordeclientes-eea01972-6ea3-4c59-b796-98d3d6b00976",
  storageBucket: "inspired-anchor-477400-s4.firebasestorage.app",
  messagingSenderId: "33184185661",
  oAuthClientId: "33184185661-gnldb37h6qml5i9qsbu9genghjivsoo1.apps.googleusercontent.com",
};

const firebaseConfig = {
  ...hardcodedConfig,
  ...(firebaseConfigFile || {}),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence in IndexedDB for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
    logger.warn('Firestore offline persistence notice:', err);
  }
});

// Ensure network connection is enabled for real-time synchronization
enableNetwork(db).catch(() => {});

// Test and validate server connection (conforms to Firebase Skill guidelines)
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'app_settings', 'main_settings'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      logger.info('Firestore client is currently offline. Operating from internal device storage.');
    }
    return false;
  }
}
testFirestoreConnection().catch(() => {});

const SETTINGS_DOC_ID = 'main_settings';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function sanitizeDataForFirestore(obj: any): any {
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

export async function fetchAppDataFromFirestore(): Promise<AppData | null> {
  if (isQuotaExhausted) return null;
  try {
    const clientsSnap = await getDocs(collection(db, 'clients'));
    const chargesSnap = await getDocs(collection(db, 'charges'));
    const logsSnap = await getDocs(collection(db, 'sentLogs'));
    const settingsSnap = await getDocs(collection(db, 'app_settings'));

    const clients: Client[] = [];
    clientsSnap.forEach((d) => {
      clients.push({ id: d.id, ...d.data() } as Client);
    });

    const charges: Charge[] = [];
    chargesSnap.forEach((d) => {
      charges.push({ id: d.id, ...d.data() } as Charge);
    });

    const sentLogs: SentMessageLog[] = [];
    logsSnap.forEach((d) => {
      sentLogs.push({ id: d.id, ...d.data() } as SentMessageLog);
    });

    let settings = { ...initialAppData.settings };
    let updatedAt = Date.now();
    settingsSnap.forEach((d) => {
      if (d.id === SETTINGS_DOC_ID) {
        const raw = d.data();
        if (raw.settings) settings = { ...initialAppData.settings, ...raw.settings };
        if (typeof raw.updatedAt === 'number') updatedAt = raw.updatedAt;
      }
    });

    return {
      clients,
      charges,
      settings,
      sentLogs,
      updatedAt,
    };
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return null;
    }
    logger.warn('Firestore fetch notice:', err);
    return null;
  }
}

// Real-time synchronization engine via individual collection listeners
export function subscribeToAppData(
  onData: (data: AppData, exists: boolean) => void,
  onError?: (err: Error) => void
) {
  if (isQuotaExhausted) {
    return () => {};
  }

  let clients: Client[] = [];
  let charges: Charge[] = [];
  let sentLogs: SentMessageLog[] = [];
  let settings: CompanySettings = (() => {
    try {
      const saved = localStorage.getItem('gc_v1_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.settings) {
          return { ...initialAppData.settings, ...parsed.settings };
        }
      }
    } catch {}
    return { ...initialAppData.settings };
  })();
  let updatedAt = Date.now();

  let clientsLoaded = false;
  let chargesLoaded = false;
  let logsLoaded = false;
  let settingsLoaded = false;

  let emitDebounceTimer: any = null;
  const emit = () => {
    if (!clientsLoaded || !chargesLoaded || !logsLoaded || !settingsLoaded) {
      return;
    }
    if (emitDebounceTimer) clearTimeout(emitDebounceTimer);
    emitDebounceTimer = setTimeout(() => {
      onData(
        {
          clients,
          charges,
          settings,
          sentLogs,
          updatedAt,
        },
        true
      );
    }, 40);
  };

  const handleSnapshotError = (err: any) => {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      try {
        unsubClients();
        unsubCharges();
        unsubLogs();
        unsubSettings();
      } catch {}
      return;
    }
    logger.warn('Firestore snapshot notice:', err);
    if (onError) onError(err);
  };

  const unsubClients = onSnapshot(
    collection(db, 'clients'),
    (snapshot) => {
      clients = [];
      cloudClientsCache.clear();
      snapshot.forEach((d) => {
        const clientItem = { id: d.id, ...d.data() } as Client;
        clients.push(clientItem);
        cloudClientsCache.set(clientItem.id, JSON.stringify(clientItem));
      });
      clientsLoaded = true;
      emit();
    },
    handleSnapshotError
  );

  const unsubCharges = onSnapshot(
    collection(db, 'charges'),
    (snapshot) => {
      charges = [];
      cloudChargesCache.clear();
      snapshot.forEach((d) => {
        const chargeItem = { id: d.id, ...d.data() } as Charge;
        charges.push(chargeItem);
        cloudChargesCache.set(chargeItem.id, JSON.stringify(chargeItem));
      });
      chargesLoaded = true;
      emit();
    },
    handleSnapshotError
  );

  const unsubLogs = onSnapshot(
    collection(db, 'sentLogs'),
    (snapshot) => {
      sentLogs = [];
      cloudLogsCache.clear();
      snapshot.forEach((d) => {
        const logItem = { id: d.id, ...d.data() } as SentMessageLog;
        sentLogs.push(logItem);
        cloudLogsCache.set(logItem.id, JSON.stringify(logItem));
      });
      logsLoaded = true;
      emit();
    },
    handleSnapshotError
  );

  const unsubSettings = onSnapshot(
    collection(db, 'app_settings'),
    (snapshot) => {
      snapshot.forEach((d) => {
        if (d.id === SETTINGS_DOC_ID) {
          const raw = d.data();
          if (raw.settings) {
            settings = { ...initialAppData.settings, ...raw.settings };
            cloudSettingsHash = JSON.stringify(settings);
          }
          if (typeof raw.updatedAt === 'number') updatedAt = raw.updatedAt;
        }
      });
      settingsLoaded = true;
      emit();
    },
    handleSnapshotError
  );

  return () => {
    if (emitDebounceTimer) clearTimeout(emitDebounceTimer);
    unsubClients();
    unsubCharges();
    unsubLogs();
    unsubSettings();
  };
}

// In-memory cache of synced docs to prevent re-writing unchanged documents
const cloudClientsCache = new Map<string, string>();
const cloudChargesCache = new Map<string, string>();
const cloudLogsCache = new Map<string, string>();
let cloudSettingsHash = '';

// Delete WhatsApp media from Cloud Firestore settings
export async function deleteWhatsAppMediaFromCloud(): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const settingsRef = doc(db, 'app_settings', SETTINGS_DOC_ID);
    await setDoc(settingsRef, {
      settings: {
        whatsappMedia: deleteField(),
      },
      updatedAt: Date.now(),
    }, { merge: true });
    cloudSettingsHash = '';
  } catch (err) {
    logger.warn('Notice deleting whatsappMedia in Firestore:', err);
  }
}

// Save AppData to Firestore with granular delta-tracking
export async function saveAppDataToFirestore(data: AppData): Promise<void> {
  if (isQuotaExhausted) {
    return;
  }

  try {
    // 1. Check settings
    const settingsJson = JSON.stringify(data.settings || {});
    const settingsChanged = cloudSettingsHash !== settingsJson;

    // 2. Identify dirty clients
    const dirtyClients: Client[] = [];
    for (const client of data.clients || []) {
      if (client && client.id) {
        const rawJson = JSON.stringify(client);
        if (cloudClientsCache.get(client.id) !== rawJson) {
          dirtyClients.push(client);
        }
      }
    }

    // 3. Identify dirty charges
    const dirtyCharges: Charge[] = [];
    for (const charge of data.charges || []) {
      if (charge && charge.id) {
        const rawJson = JSON.stringify(charge);
        if (cloudChargesCache.get(charge.id) !== rawJson) {
          dirtyCharges.push(charge);
        }
      }
    }

    // 4. Identify dirty logs
    const dirtyLogs: SentMessageLog[] = [];
    for (const log of data.sentLogs || []) {
      if (log && log.id) {
        const rawJson = JSON.stringify(log);
        if (cloudLogsCache.get(log.id) !== rawJson) {
          dirtyLogs.push(log);
        }
      }
    }

    // If nothing changed, exit instantly (0 network operations, 0 delay!)
    if (!settingsChanged && dirtyClients.length === 0 && dirtyCharges.length === 0 && dirtyLogs.length === 0) {
      return;
    }

    // Commit dirty operations in batches of at most 400 (well within Firestore 500 limit)
    let currentBatch = writeBatch(db);
    let opCount = 0;

    const commitCurrentBatch = async () => {
      if (opCount > 0) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    };

    if (settingsChanged) {
      const settingsRef = doc(db, 'app_settings', SETTINGS_DOC_ID);
      const sanitizedSettings = sanitizeDataForFirestore({
        settings: data.settings || {},
        updatedAt: Date.now(),
      });

      if (!data.settings?.whatsappMedia) {
        if (sanitizedSettings?.settings) {
          delete sanitizedSettings.settings.whatsappMedia;
        }
        currentBatch.set(settingsRef, sanitizedSettings);
      } else {
        currentBatch.set(settingsRef, sanitizedSettings, { merge: true });
      }
      opCount++;
      cloudSettingsHash = settingsJson;
    }

    for (const client of dirtyClients) {
      const clientRef = doc(db, 'clients', client.id);
      const { id, ...rest } = client;
      currentBatch.set(clientRef, sanitizeDataForFirestore(rest), { merge: true });
      cloudClientsCache.set(client.id, JSON.stringify(client));
      opCount++;
      if (opCount >= 400) await commitCurrentBatch();
    }

    for (const charge of dirtyCharges) {
      const chargeRef = doc(db, 'charges', charge.id);
      const { id, ...rest } = charge;
      currentBatch.set(chargeRef, sanitizeDataForFirestore(rest), { merge: true });
      cloudChargesCache.set(charge.id, JSON.stringify(charge));
      opCount++;
      if (opCount >= 400) await commitCurrentBatch();
    }

    for (const log of dirtyLogs) {
      const logRef = doc(db, 'sentLogs', log.id);
      const { id, ...rest } = log;
      currentBatch.set(logRef, sanitizeDataForFirestore(rest), { merge: true });
      cloudLogsCache.set(log.id, JSON.stringify(log));
      opCount++;
      if (opCount >= 400) await commitCurrentBatch();
    }

    if (opCount > 0) {
      await commitCurrentBatch();
    }
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Firestore write notice:', err);
    throw err;
  }
}

// Explicit deletion functions for user actions
export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  if (isQuotaExhausted || !clientId) return;
  cloudClientsCache.delete(clientId);
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Delete client error:', err);
  }
}

export async function deleteClientsBatchFromFirestore(clientIds: string[]): Promise<void> {
  if (isQuotaExhausted || !clientIds || clientIds.length === 0) return;
  for (const id of clientIds) {
    if (id) cloudClientsCache.delete(id);
  }
  try {
    const batch = writeBatch(db);
    for (const id of clientIds) {
      if (id) {
        batch.delete(doc(db, 'clients', id));
      }
    }
    await batch.commit();
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Delete clients batch error:', err);
  }
}

export async function deleteChargeFromFirestore(chargeId: string): Promise<void> {
  if (isQuotaExhausted || !chargeId) return;
  cloudChargesCache.delete(chargeId);
  try {
    await deleteDoc(doc(db, 'charges', chargeId));
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Delete charge error:', err);
  }
}

export async function deleteChargesBatchFromFirestore(chargeIds: string[]): Promise<void> {
  if (isQuotaExhausted || !chargeIds || chargeIds.length === 0) return;
  for (const id of chargeIds) {
    if (id) cloudChargesCache.delete(id);
  }
  try {
    const batch = writeBatch(db);
    for (const id of chargeIds) {
      if (id) {
        batch.delete(doc(db, 'charges', id));
      }
    }
    await batch.commit();
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Delete charges batch error:', err);
  }
}

export async function deleteSentLogFromFirestore(logId: string): Promise<void> {
  if (isQuotaExhausted || !logId) return;
  cloudLogsCache.delete(logId);
  try {
    await deleteDoc(doc(db, 'sentLogs', logId));
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Delete sentLog error:', err);
  }
}

export async function deleteSentLogsBatchFromFirestore(logIds: string[]): Promise<void> {
  if (isQuotaExhausted || !logIds || logIds.length === 0) return;
  for (const id of logIds) {
    if (id) cloudLogsCache.delete(id);
  }
  try {
    const batch = writeBatch(db);
    for (const id of logIds) {
      if (id) {
        batch.delete(doc(db, 'sentLogs', id));
      }
    }
    await batch.commit();
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Delete sentLogs batch error:', err);
  }
}

// -------------------------------------------------------------
// Restore Points (Pontos de Restauração) Sync Engine
// -------------------------------------------------------------

export async function fetchRestorePointsFromFirestore(): Promise<SystemRestorePoint[]> {
  if (isQuotaExhausted) return [];
  try {
    const snap = await getDocs(collection(db, 'restore_points'));
    const points: SystemRestorePoint[] = [];
    snap.forEach((d) => {
      points.push({ id: d.id, ...d.data() } as SystemRestorePoint);
    });
    // Sort newest first
    return points.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return [];
    }
    logger.warn('Fetch restore points error:', err);
    return [];
  }
}

export function subscribeToRestorePoints(
  onPoints: (points: SystemRestorePoint[]) => void,
  onError?: (err: Error) => void
) {
  if (isQuotaExhausted) {
    return () => {};
  }

  const unsub = onSnapshot(
    collection(db, 'restore_points'),
    (snapshot) => {
      const points: SystemRestorePoint[] = [];
      snapshot.forEach((d) => {
        points.push({ id: d.id, ...d.data() } as SystemRestorePoint);
      });
      // Sort newest first
      points.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onPoints(points);
    },
    (err: any) => {
      const errorMsg = String(err?.message || err);
      if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
        markQuotaExhausted();
        return;
      }
      logger.warn('Restore points snapshot error:', err);
      if (onError) onError(err);
    }
  );

  return unsub;
}

export async function saveRestorePointToFirestore(point: SystemRestorePoint): Promise<void> {
  if (isQuotaExhausted || !point || !point.id) return;
  try {
    const pointRef = doc(db, 'restore_points', point.id);
    const { id: _id, ...rest } = point;
    await setDoc(pointRef, sanitizeDataForFirestore(rest), { merge: true });
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Save restore point error:', err);
    throw err;
  }
}

export async function deleteRestorePointFromFirestore(pointId: string): Promise<void> {
  if (isQuotaExhausted || !pointId) return;
  try {
    await deleteDoc(doc(db, 'restore_points', pointId));
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    logger.warn('Delete restore point error:', err);
  }
}

