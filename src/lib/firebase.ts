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
  setLogLevel as setFirestoreLogLevel
} from 'firebase/firestore';
import { AppData, Client, Charge, SentMessageLog, CompanySettings } from '../types';
import { initialAppData } from '../data/initialData';
import firebaseConfigFile from '../../firebase-applet-config.json';

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
    console.info('Firestore daily write/read quota reached. Switched to local device persistence mode.');
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

// Ensure network connection is enabled for real-time synchronization
enableNetwork(db).catch(() => {});

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
    console.warn('Firestore fetch notice:', err);
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
  let settings: CompanySettings = { ...initialAppData.settings };
  let updatedAt = Date.now();

  const emit = () => {
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
    console.warn('Firestore snapshot notice:', err);
    if (onError) onError(err);
  };

  const unsubClients = onSnapshot(
    collection(db, 'clients'),
    (snapshot) => {
      clients = [];
      snapshot.forEach((d) => {
        clients.push({ id: d.id, ...d.data() } as Client);
      });
      emit();
    },
    handleSnapshotError
  );

  const unsubCharges = onSnapshot(
    collection(db, 'charges'),
    (snapshot) => {
      charges = [];
      snapshot.forEach((d) => {
        charges.push({ id: d.id, ...d.data() } as Charge);
      });
      emit();
    },
    handleSnapshotError
  );

  const unsubLogs = onSnapshot(
    collection(db, 'sentLogs'),
    (snapshot) => {
      sentLogs = [];
      snapshot.forEach((d) => {
        sentLogs.push({ id: d.id, ...d.data() } as SentMessageLog);
      });
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
          if (raw.settings) settings = { ...initialAppData.settings, ...raw.settings };
          if (typeof raw.updatedAt === 'number') updatedAt = raw.updatedAt;
        }
      });
      emit();
    },
    handleSnapshotError
  );

  return () => {
    unsubClients();
    unsubCharges();
    unsubLogs();
    unsubSettings();
  };
}

// Save AppData to Firestore
export async function saveAppDataToFirestore(data: AppData): Promise<void> {
  if (isQuotaExhausted) {
    return;
  }

  try {
    const batch = writeBatch(db);

    // 1. Settings doc
    const settingsRef = doc(db, 'app_settings', SETTINGS_DOC_ID);
    batch.set(settingsRef, sanitizeDataForFirestore({
      settings: data.settings || {},
      updatedAt: Date.now(),
    }), { merge: true });

    // 2. Set/Update all current clients
    for (const client of data.clients || []) {
      if (client && client.id) {
        const clientRef = doc(db, 'clients', client.id);
        const { id, ...rest } = client;
        batch.set(clientRef, sanitizeDataForFirestore(rest), { merge: true });
      }
    }

    // 3. Set/Update all current charges
    for (const charge of data.charges || []) {
      if (charge && charge.id) {
        const chargeRef = doc(db, 'charges', charge.id);
        const { id, ...rest } = charge;
        batch.set(chargeRef, sanitizeDataForFirestore(rest), { merge: true });
      }
    }

    // 4. Set/Update all current logs
    for (const log of data.sentLogs || []) {
      if (log && log.id) {
        const logRef = doc(db, 'sentLogs', log.id);
        const { id, ...rest } = log;
        batch.set(logRef, sanitizeDataForFirestore(rest), { merge: true });
      }
    }

    await batch.commit();
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    console.warn('Firestore write notice:', err);
    throw err;
  }
}

// Explicit deletion functions for user actions
export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    console.warn('Delete client error:', err);
  }
}

export async function deleteChargeFromFirestore(chargeId: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, 'charges', chargeId));
  } catch (err: any) {
    const errorMsg = String(err?.message || err);
    if (errorMsg.includes('resource-exhausted') || errorMsg.includes('Quota exceeded') || err?.code === 'resource-exhausted') {
      markQuotaExhausted();
      return;
    }
    console.warn('Delete charge error:', err);
  }
}
