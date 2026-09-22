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

function isRecentRecord(record: any, maxAgeMs = 5 * 60 * 1000): boolean {
  if (!record) return false;
  const timeStr = record.createdAt || record.timestamp || record.paidAt;
  if (!timeStr) return false;
  const time = new Date(timeStr).getTime();
  if (isNaN(time) || time <= 0) return false;
  return Date.now() - time < maxAgeMs;
}

// Merge AppData: Cloud Firestore snapshot is authoritative for remote state.
// Filter out local pending deletions and preserve recently created/updated local records.
export function mergeAppData(local: AppData, cloud: AppData): AppData {
  const pendingDeletions = getPendingDeletions();
  const deletedClientIds = new Set(pendingDeletions.clients);
  const deletedChargeIds = new Set(pendingDeletions.charges);
  const deletedLogIds = new Set(pendingDeletions.logs);

  const cloudClients = Array.isArray(cloud?.clients) ? cloud.clients : [];
  const cloudCharges = Array.isArray(cloud?.charges) ? cloud.charges : [];
  const cloudLogs = Array.isArray(cloud?.sentLogs) ? cloud.sentLogs : [];

  const localClients = Array.isArray(local?.clients) ? local.clients : [];
  const localCharges = Array.isArray(local?.charges) ? local.charges : [];
  const localLogs = Array.isArray(local?.sentLogs) ? local.sentLogs : [];

  const localUpdated = typeof local?.updatedAt === 'number' ? local.updatedAt : 0;
  const cloudUpdated = typeof cloud?.updatedAt === 'number' ? cloud.updatedAt : 0;
  const isLocalNewer = localUpdated > cloudUpdated;

  // 1. Clients: If local is newer, keep local modifications; otherwise prioritize cloud + recent local
  let finalClients: Client[];
  if (isLocalNewer) {
    const localMap = new Map<string, Client>();
    for (const c of localClients) {
      if (c?.id && !deletedClientIds.has(c.id)) localMap.set(c.id, c);
    }
    for (const c of cloudClients) {
      if (c?.id && !deletedClientIds.has(c.id) && !localMap.has(c.id)) {
        localMap.set(c.id, c);
      }
    }
    finalClients = Array.from(localMap.values());
  } else {
    const cloudMap = new Map<string, Client>();
    for (const c of cloudClients) {
      if (c?.id && !deletedClientIds.has(c.id)) cloudMap.set(c.id, c);
    }
    for (const c of localClients) {
      if (c?.id && !deletedClientIds.has(c.id) && !cloudMap.has(c.id) && isRecentRecord(c)) {
        cloudMap.set(c.id, c);
      }
    }
    finalClients = Array.from(cloudMap.values());
  }

  // 2. Charges: If local is newer, keep local charges; otherwise prioritize cloud + recent local
  let finalCharges: Charge[];
  if (isLocalNewer) {
    const localChargeMap = new Map<string, Charge>();
    for (const ch of localCharges) {
      if (ch?.id && !deletedChargeIds.has(ch.id)) localChargeMap.set(ch.id, ch);
    }
    for (const ch of cloudCharges) {
      if (ch?.id && !deletedChargeIds.has(ch.id) && !localChargeMap.has(ch.id)) {
        localChargeMap.set(ch.id, ch);
      }
    }
    finalCharges = Array.from(localChargeMap.values());
  } else {
    const cloudChargeMap = new Map<string, Charge>();
    for (const ch of cloudCharges) {
      if (ch?.id && !deletedChargeIds.has(ch.id)) cloudChargeMap.set(ch.id, ch);
    }
    for (const ch of localCharges) {
      if (ch?.id && !deletedChargeIds.has(ch.id) && !cloudChargeMap.has(ch.id) && isRecentRecord(ch)) {
        cloudChargeMap.set(ch.id, ch);
      }
    }
    finalCharges = Array.from(cloudChargeMap.values());
  }

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

