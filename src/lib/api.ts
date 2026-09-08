import { AppData, CompanySettings, SystemRestorePoint } from '../types';
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
import { cleanClientName, isDateString } from '../utils/clientParser';

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
    return { ...initialAppData, updatedAt: Date.now() };
  }
  const rawClients = Array.isArray(raw.clients) ? raw.clients : [];
  const rawCharges = Array.isArray(raw.charges) ? raw.charges : [];
  const rawLogs = Array.isArray(raw.sentLogs) ? raw.sentLogs : [];

  // Remove legacy template mock clients & invalid date clients
  const dummyIds = new Set(['c-1', 'c-2', 'c-3']);
  const dummyNames = new Set(['Ana Silva', 'Carlos Oliveira', 'Mariana Souza', 'Mariana Sousa']);

  const cleanClients = rawClients
    .filter((c: any) => {
      if (!c || typeof c !== 'object') return false;
      if (dummyIds.has(c?.id)) return false;
      const rawName = String(c?.name || '').trim();
      if (dummyNames.has(rawName)) return false;
      // Filter out clients whose name is actually a date line
      if (isDateString(rawName)) return false;
      const cleanedName = cleanClientName(rawName);
      if (!cleanedName || isDateString(cleanedName)) return false;
      return true;
    })
    .map((c: any, index: number) => {
      const rawName = String(c?.name || '').trim();
      const finalName = cleanClientName(rawName) || rawName;
      return {
        ...c,
        id: String(c.id || `c_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`),
        name: finalName,
        phone: String(c.phone || ''),
      };
    });

  const validClientIds = new Set(cleanClients.map((c: any) => c.id));

  const cleanCharges = rawCharges
    .filter(
      (ch: any) => ch && typeof ch === 'object' && !dummyIds.has(ch?.clientId) && !['ch-1', 'ch-2', 'ch-3'].includes(ch?.id)
    )
    .map((ch: any, index: number) => ({
      ...ch,
      id: String(ch.id || `ch_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`),
      clientId: String(ch.clientId || ''),
    }));

  const cleanLogs = rawLogs
    .filter(
      (l: any) => l && typeof l === 'object' && !dummyIds.has(l?.clientId) && !dummyNames.has((l?.clientName || '').trim())
    )
    .map((l: any, index: number) => ({
      ...l,
      id: String(l.id || `l_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`),
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
  };
}

const isLocalServer = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.host;
  return host.includes('localhost:3000') || host.includes('127.0.0.1:3000');
};

// Fetch current state from Cloud Firestore or Local Server
export async function fetchAppData(): Promise<{ data: AppData | null; exists: boolean }> {
  // 1. Direct Cloud Firestore (Master Database)
  try {
    const cloudData = await fetchAppDataFromFirestore();
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

import { getPendingDeletions } from './offlineSyncManager';

export function mergeAppData(local: AppData, cloud: AppData): AppData {
  const pendingDeletions = getPendingDeletions();
  const deletedClientIds = new Set(pendingDeletions.clients);
  const deletedChargeIds = new Set(pendingDeletions.charges);
  const deletedLogIds = new Set(pendingDeletions.logs);

  const localClients = Array.isArray(local?.clients) ? local.clients : [];
  const cloudClients = Array.isArray(cloud?.clients) ? cloud.clients : [];

  const localCharges = Array.isArray(local?.charges) ? local.charges : [];
  const cloudCharges = Array.isArray(cloud?.charges) ? cloud.charges : [];

  const localLogs = Array.isArray(local?.sentLogs) ? local.sentLogs : [];
  const cloudLogs = Array.isArray(cloud?.sentLogs) ? cloud.sentLogs : [];

  // Smart merge clients: preserve local offline creations & updates, respect local deletions
  const clientMap = new Map<string, import('../types').Client>();
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
        const existingCloud = clientMap.get(c.id)!;
        clientMap.set(c.id, { ...existingCloud, ...c });
      }
    }
  }
  const mergedClients = Array.from(clientMap.values());

  // Smart merge charges: preserve local offline creations & updates, respect local deletions
  const chargeMap = new Map<string, import('../types').Charge>();
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
        const existingCloud = chargeMap.get(ch.id)!;
        chargeMap.set(ch.id, { ...existingCloud, ...ch });
      }
    }
  }
  const mergedCharges = Array.from(chargeMap.values());

  // Smart merge sent logs
  const logMap = new Map<string, import('../types').SentMessageLog>();
  for (const l of cloudLogs) {
    if (l?.id && !deletedLogIds.has(l.id)) {
      logMap.set(l.id, l);
    }
  }
  for (const l of localLogs) {
    if (l?.id && !deletedLogIds.has(l.id)) {
      if (!logMap.has(l.id)) {
        logMap.set(l.id, l);
      }
    }
  }
  const mergedLogs = Array.from(logMap.values());

  const localSettings: Partial<CompanySettings> = local?.settings || {};
  const cloudSettings: Partial<CompanySettings> = cloud?.settings || {};

  const localUpdated = typeof local?.updatedAt === 'number' ? local.updatedAt : 0;
  const cloudUpdated = typeof cloud?.updatedAt === 'number' ? cloud.updatedAt : 0;
  const isLocalNewer = localUpdated >= cloudUpdated;

  const baseSettings = isLocalNewer
    ? { ...initialAppData.settings, ...cloudSettings, ...localSettings }
    : { ...initialAppData.settings, ...localSettings, ...cloudSettings };

  // Resilient resolution of whatsappMedia
  let chosenMedia: WhatsAppMediaAttachment | undefined;
  if (localSettings.whatsappMedia && cloudSettings.whatsappMedia) {
    const localMediaTime = new Date(localSettings.whatsappMedia.uploadedAt || 0).getTime();
    const cloudMediaTime = new Date(cloudSettings.whatsappMedia.uploadedAt || 0).getTime();
    if (localMediaTime !== cloudMediaTime) {
      chosenMedia = localMediaTime >= cloudMediaTime ? localSettings.whatsappMedia : cloudSettings.whatsappMedia;
    } else {
      chosenMedia = isLocalNewer ? localSettings.whatsappMedia : cloudSettings.whatsappMedia;
    }
  } else if (localSettings.whatsappMedia && !cloudSettings.whatsappMedia) {
    const localMediaTime = new Date(localSettings.whatsappMedia.uploadedAt || 0).getTime();
    const isRecentUpload = Date.now() - localMediaTime < 120000;
    if (isLocalNewer || isRecentUpload || (cloudUpdated - localUpdated < 5000)) {
      chosenMedia = localSettings.whatsappMedia;
    } else {
      chosenMedia = undefined;
    }
  } else if (!localSettings.whatsappMedia && cloudSettings.whatsappMedia) {
    if (!isLocalNewer || (localUpdated - cloudUpdated < 5000)) {
      chosenMedia = cloudSettings.whatsappMedia;
    } else {
      chosenMedia = undefined;
    }
  }

  const mergedSettings: CompanySettings = {
    ...baseSettings,
    whatsappMethod: isLocalNewer
      ? (localSettings.whatsappMethod || cloudSettings.whatsappMethod || 'direct_app')
      : (cloudSettings.whatsappMethod || localSettings.whatsappMethod || 'direct_app'),
    whatsappMedia: chosenMedia || undefined,
  };

  if (!mergedSettings.whatsappMedia) {
    delete mergedSettings.whatsappMedia;
  }

  return {
    clients: mergedClients,
    charges: mergedCharges,
    settings: mergedSettings,
    sentLogs: mergedLogs,
    updatedAt: Math.max(cloudUpdated, localUpdated),
  };
}

