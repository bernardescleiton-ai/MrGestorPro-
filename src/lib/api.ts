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

  // Remove legacy template mock clients & invalid date clients
  const dummyIds = new Set(['c-1', 'c-2', 'c-3']);
  const dummyNames = new Set(['Ana Silva', 'Carlos Oliveira', 'Mariana Souza', 'Mariana Sousa']);

  const cleanClients = rawClients
    .filter((c: any) => {
      if (!c || typeof c !== 'object') return false;
      if (dummyIds.has(c?.id)) return false;
      const rawName = String(c?.name || '').trim();
      if (dummyNames.has(rawName)) return false;
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
    .filter(
      (l: any) => l && typeof l === 'object' && !dummyIds.has(l?.clientId) && !dummyNames.has((l?.clientName || '').trim())
    )
    .map((l: any, index: number) => ({
      ...l,
      id: String(l.id || `l_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`),
    }));

  const validClientIds = new Set(cleanClients.map((c: any) => c.id));
  const phoneToClientId = new Map<string, string>();
  const nameToClientId = new Map<string, string>();
  cleanClients.forEach((c: any) => {
    const cleanPhone = String(c.phone || '').replace(/\D/g, '').replace(/^55/, '');
    if (cleanPhone.length >= 8) phoneToClientId.set(cleanPhone, c.id);
    const cleanName = String(c.name || '').trim().toLowerCase();
    if (cleanName) nameToClientId.set(cleanName, c.id);
  });

  const logChargeMap = new Map<string, any>();
  const logClientMap = new Map<string, any>();
  cleanLogs.forEach((l: any) => {
    if (l.chargeId) logChargeMap.set(l.chargeId, l);
    if (l.clientId) logClientMap.set(l.clientId, l);
  });

  const cleanCharges = rawCharges
    .filter(
      (ch: any) => ch && typeof ch === 'object' && !dummyIds.has(ch?.clientId) && !['ch-1', 'ch-2', 'ch-3'].includes(ch?.id)
    )
    .map((ch: any, index: number) => {
      let resolvedClientId = String(ch.clientId || '');
      if (!validClientIds.has(resolvedClientId)) {
        const cleanChIdPhone = resolvedClientId.replace(/\D/g, '').replace(/^55/, '');
        if (cleanChIdPhone.length >= 8 && phoneToClientId.has(cleanChIdPhone)) {
          resolvedClientId = phoneToClientId.get(cleanChIdPhone)!;
        } else {
          const matchedLog =
            (ch.id ? logChargeMap.get(ch.id) : undefined) ||
            (resolvedClientId ? logClientMap.get(resolvedClientId) : undefined);
          if (matchedLog) {
            const logPhone = String(matchedLog.phone || '').replace(/\D/g, '').replace(/^55/, '');
            const logName = String(matchedLog.clientName || '').trim().toLowerCase();
            if (logPhone && phoneToClientId.has(logPhone)) {
              resolvedClientId = phoneToClientId.get(logPhone)!;
            } else if (logName && nameToClientId.has(logName)) {
              resolvedClientId = nameToClientId.get(logName)!;
            } else if (matchedLog.clientId && validClientIds.has(matchedLog.clientId)) {
              resolvedClientId = matchedLog.clientId;
            }
          }
        }
      }
      return {
        ...ch,
        id: String(ch.id || `ch_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`),
        clientId: resolvedClientId,
      };
    });

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
  const isLocalNewer = localUpdated > cloudUpdated;

  // 1. Clients: Inclusive union of cloud and local records (excluding explicit deletions)
  const clientMap = new Map<string, Client>();
  for (const c of cloudClients) {
    if (c?.id && !deletedClientIds.has(c.id)) {
      clientMap.set(c.id, c);
    }
  }
  for (const c of localClients) {
    if (c?.id && !deletedClientIds.has(c.id)) {
      if (!clientMap.has(c.id) || isLocalNewer) {
        clientMap.set(c.id, c);
      }
    }
  }
  const finalClients = Array.from(clientMap.values());

  // 2. Charges: Inclusive union of cloud and local records (excluding explicit deletions)
  const chargeMap = new Map<string, Charge>();
  for (const ch of cloudCharges) {
    if (ch?.id && !deletedChargeIds.has(ch.id)) {
      chargeMap.set(ch.id, ch);
    }
  }
  for (const ch of localCharges) {
    if (ch?.id && !deletedChargeIds.has(ch.id)) {
      if (!chargeMap.has(ch.id) || isLocalNewer) {
        chargeMap.set(ch.id, ch);
      }
    }
  }
  const finalCharges = Array.from(chargeMap.values());

  // 3. SentLogs: Merge unique logs
  const logMap = new Map<string, SentMessageLog>();
  for (const l of cloudLogs) {
    if (l?.id && !deletedLogIds.has(l.id)) logMap.set(l.id, l);
  }
  for (const l of localLogs) {
    if (l?.id && !deletedLogIds.has(l.id) && (!logMap.has(l.id) || isLocalNewer)) {
      logMap.set(l.id, l);
    }
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

