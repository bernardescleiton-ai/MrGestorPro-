import { AppData, CompanySettings } from '../types';
import { initialAppData } from '../data/initialData';
import {
  subscribeToAppData, 
  saveAppDataToFirestore, 
  fetchAppDataFromFirestore, 
  deleteClientFromFirestore, 
  deleteClientsBatchFromFirestore,
  deleteChargeFromFirestore, 
  deleteChargesBatchFromFirestore,
  deleteSentLogFromFirestore,
  deleteSentLogsBatchFromFirestore,
  fetchRestorePointsFromFirestore,
  subscribeToRestorePoints,
  saveRestorePointToFirestore,
  deleteRestorePointFromFirestore,
  deleteWhatsAppMediaFromCloud
} from './firebase';
import { logger } from './logger';
export { 
  deleteClientFromFirestore, 
  deleteClientsBatchFromFirestore,
  deleteChargeFromFirestore, 
  deleteChargesBatchFromFirestore,
  deleteSentLogFromFirestore,
  deleteSentLogsBatchFromFirestore,
  fetchRestorePointsFromFirestore,
  subscribeToRestorePoints,
  saveRestorePointToFirestore,
  deleteRestorePointFromFirestore,
  deleteWhatsAppMediaFromCloud
};

export function sanitizeAppData(raw: any): AppData {
  if (!raw || typeof raw !== 'object') {
    return { ...initialAppData, updatedAt: Date.now(), _sanitized: true } as AppData;
  }
  if ((raw as any)._sanitized === true) {
    return raw as AppData;
  }
  const rawClients = Array.isArray(raw.clients) ? raw.clients : [];
  const rawCharges = Array.isArray(raw.charges) ? raw.charges : [];
  const rawLogs = Array.isArray(raw.sentLogs) ? raw.sentLogs : [];

  const cleanClients = rawClients
    .filter((c: any) => {
      if (!c || typeof c !== 'object') return false;
      const rawName = String(c?.name || '').trim();
      if (!rawName) return false;
      return true;
    })
    .map((c: any, index: number) => {
      const exactName = typeof c?.name === 'string' ? c.name.trim() : String(c?.name || '').trim();
      return {
        ...c,
        id: String(c.id || `c_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`),
        name: exactName || 'Cliente',
        phone: String(c.phone || ''),
      };
    });

  const cleanLogs = rawLogs
    .filter((l: any) => l && typeof l === 'object')
    .map((l: any, index: number) => ({
      ...l,
      id: String(l.id || `l_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`),
    }));

  const cleanCharges = rawCharges
    .filter((ch: any) => ch && typeof ch === 'object')
    .map((ch: any, index: number) => ({
      ...ch,
      id: String(ch.id || `ch_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`),
      clientId: String(ch.clientId || ''),
    }));

  return {
    clients: cleanClients,
    charges: cleanCharges,
    settings: {
      ...initialAppData.settings,
      ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}),
    },
    sentLogs: cleanLogs,
    updatedAt: typeof raw.updatedAt === 'number' && raw.updatedAt > 0 ? raw.updatedAt : Date.now(),
    _sanitized: true,
  } as AppData;
}

const isLocalServer = (): boolean => {
  return typeof window !== 'undefined';
};

// Fetch current state from Cloud Firestore or Local Server
export async function fetchAppData(): Promise<{ data: AppData | null; exists: boolean }> {
  // 1. Direct Cloud Firestore (Master Database)
  try {
    const cloudData = await fetchAppDataFromFirestore();
    logger.info('Fetched app data from Firestore:', JSON.stringify(cloudData));
    if (cloudData) {
      return {
        data: sanitizeAppData(cloudData),
        exists: true,
      };
    }
  } catch (firestoreErr) {
    logger.warn('Firestore fetch notice:', firestoreErr);
  }

  // 2. If running on local server fallback
  if (isLocalServer()) {
    try {
      const res = await fetch('/api/data', {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            data: sanitizeAppData(json.data),
            exists: true,
          };
        }
      }
    } catch {
      // Local fallback
    }
  }

  return {
    data: null,
    exists: false,
  };
}

// Save state to Cloud Firestore and local server
export async function saveAppData(data: AppData, _debounceMs: number = 0): Promise<void> {
  const safeData = sanitizeAppData(data);

  // 1. Always save directly to Cloud Firestore (guarantees real-time sync with APK & Web)
  try {
    logger.info('Saving app data to Firestore:', JSON.stringify(safeData));
    await saveAppDataToFirestore(safeData);
  } catch (err) {
    logger.warn('Cloud Firestore save notice:', err);
  }

  // 2. If running on local dev server, also persist locally
  if (isLocalServer()) {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safeData),
      });
    } catch {
      // Local fallback
    }
  }
}

// Real-time synchronization engine via Firestore onSnapshot
export function subscribeToApiData(
  onData: (data: AppData, exists: boolean) => void,
  onError?: (err: Error) => void
) {
  return subscribeToAppData(
    (cloudData, exists) => {
      onData(sanitizeAppData(cloudData), exists);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

import { getAllDeletedEntityIds } from './offlineSyncManager';

// Merge AppData: Cloud Firestore snapshot and local storage merge seamlessly.
// Respect explicit deletions, keep full union of active records from both sources,
// and prioritize the newer record when the same entity was modified.
export function mergeAppData(local: AppData, cloud: AppData): AppData {
  const { clients: deletedClientIds, charges: deletedChargeIds, logs: deletedLogIds } = getAllDeletedEntityIds();

  const cloudClients = Array.isArray(cloud?.clients) ? cloud.clients : [];
  const cloudCharges = Array.isArray(cloud?.charges) ? cloud.charges : [];
  const cloudLogs = Array.isArray(cloud?.sentLogs) ? cloud.sentLogs : [];

  const localClients = Array.isArray(local?.clients) ? local.clients : [];
  const localCharges = Array.isArray(local?.charges) ? local.charges : [];
  const localLogs = Array.isArray(local?.sentLogs) ? local.sentLogs : [];

  const localUpdated = typeof local?.updatedAt === 'number' ? local.updatedAt : 0;
  const cloudUpdated = typeof cloud?.updatedAt === 'number' ? cloud.updatedAt : 0;

  // Additive union of cloud and local records (excluding explicit deletions)
  const clientMap = new Map<string, Client>();
  for (const c of cloudClients) {
    if (c?.id && !deletedClientIds.has(c.id)) {
      clientMap.set(c.id, c);
    }
  }
  for (const c of localClients) {
    if (c?.id && !deletedClientIds.has(c.id)) {
      if (!clientMap.has(c.id)) {
        clientMap.set(c.id, c);
      } else {
        clientMap.set(c.id, { ...clientMap.get(c.id), ...c });
      }
    }
  }
  const finalClients = Array.from(clientMap.values());

  const chargeMap = new Map<string, Charge>();
  for (const ch of cloudCharges) {
    if (ch?.id && !deletedChargeIds.has(ch.id)) {
      chargeMap.set(ch.id, ch);
    }
  }
  for (const ch of localCharges) {
    if (ch?.id && !deletedChargeIds.has(ch.id)) {
      if (!chargeMap.has(ch.id)) {
        chargeMap.set(ch.id, ch);
      } else {
        chargeMap.set(ch.id, { ...chargeMap.get(ch.id), ...ch });
      }
    }
  }
  const finalCharges = Array.from(chargeMap.values());

  const logMap = new Map<string, SentMessageLog>();
  for (const l of cloudLogs) {
    if (l?.id && !deletedLogIds.has(l.id)) logMap.set(l.id, l);
  }
  for (const l of localLogs) {
    if (l?.id && !deletedLogIds.has(l.id)) logMap.set(l.id, l);
  }
  const finalLogs = Array.from(logMap.values());

  const localSettings: Partial<CompanySettings> = local?.settings || {};
  const cloudSettings: Partial<CompanySettings> = cloud?.settings || {};

  const isCloudNewerOrEqual = cloudUpdated >= localUpdated;

  const baseSettings = isCloudNewerOrEqual
    ? { ...initialAppData.settings, ...localSettings, ...cloudSettings }
    : { ...initialAppData.settings, ...cloudSettings, ...localSettings };

  // Resilient resolution of whatsappMedia
  let chosenMedia: WhatsAppMediaAttachment | undefined;
  if (localSettings.whatsappMedia && cloudSettings.whatsappMedia) {
    const localMediaTime = new Date(localSettings.whatsappMedia.uploadedAt || 0).getTime();
    const cloudMediaTime = new Date(cloudSettings.whatsappMedia.uploadedAt || 0).getTime();
    chosenMedia = cloudMediaTime >= localMediaTime ? cloudSettings.whatsappMedia : localSettings.whatsappMedia;
  } else if (cloudSettings.whatsappMedia) {
    chosenMedia = cloudSettings.whatsappMedia;
  } else if (localSettings.whatsappMedia) {
    chosenMedia = localSettings.whatsappMedia;
  }

  const mergedSettings: CompanySettings = {
    ...baseSettings,
    whatsappMethod: isCloudNewerOrEqual
      ? (cloudSettings.whatsappMethod || localSettings.whatsappMethod || 'direct_app')
      : (localSettings.whatsappMethod || cloudSettings.whatsappMethod || 'direct_app'),
    whatsappMedia: chosenMedia || undefined,
  };

  if (!mergedSettings.whatsappMedia) {
    delete mergedSettings.whatsappMedia;
  }

  return {
    clients: finalClients,
    charges: finalCharges,
    settings: mergedSettings,
    sentLogs: finalLogs,
    updatedAt: Math.max(cloudUpdated, localUpdated),
  };
}

