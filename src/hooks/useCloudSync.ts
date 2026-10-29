import { useEffect, useRef } from 'react';
import type { AppData } from '../types';
import { subscribeToApiData, saveAppData, mergeAppData, fetchAppData } from '../lib/api';
import { canonicalJson } from '../lib/firebase';
import { markHasPendingLocalChanges, syncLocalStateToFirebase, flushPendingDeletionsToFirestore, hasPendingLocalChanges } from '../lib/offlineSyncManager';

import { logger } from '../lib/logger';
export const useCloudSync = ({
  data,
  dataRef,
  setRawData,
  setSyncTrigger: _setSyncTrigger,
  syncTrigger,
  isRemoteUpdate,
  lastSavedDataJsonRef,
  hasFetchedCloud,
  setSyncError,
}: {
  data: AppData;
  dataRef: React.MutableRefObject<AppData>;
  setRawData: React.Dispatch<React.SetStateAction<AppData>>;
  setSyncTrigger: React.Dispatch<React.SetStateAction<number>>;
  syncTrigger: number;
  isRemoteUpdate: React.MutableRefObject<boolean>;
  hasFetchedCloud: React.MutableRefObject<boolean>;
  lastSavedDataJsonRef: React.MutableRefObject<string>;
  setSyncError: (value: string | null) => void;
  setLiveToast?: unknown;
}) => {
  const lastRemoteUpdateTimestamp = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncResetMs = useRef<number>(0);

  useEffect(() => {
    hasFetchedCloud.current = true;
    const localClients = Array.isArray(dataRef.current.clients) ? dataRef.current.clients : [];
    if (localClients.length > 0) {
      saveAppData(dataRef.current, 0).catch(() => {});
      return;
    }

    fetchAppData().then((res) => {
      if (res.exists && res.data) {
        setRawData(sanitizeAppData(res.data));
        try { localStorage.setItem('gc_v1_data', JSON.stringify(res.data)); } catch {}
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleSyncReset = () => {
      const now = Date.now();
      if (now - lastSyncResetMs.current < 15000) return;
      lastSyncResetMs.current = now;

      if (hasPendingLocalChanges()) {
        syncLocalStateToFirebase(dataRef.current).then((success) => {
          if (success) setSyncError(null);
        }).catch(() => {});
      }
    };
    window.addEventListener('focus', handleSyncReset);
    window.addEventListener('online', handleSyncReset);
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') handleSyncReset(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleSyncReset);
      window.removeEventListener('online', handleSyncReset);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setSyncError]);

  useEffect(() => {
    const unsubscribe = subscribeToApiData(
      (cloudData, exists) => {
        setSyncError(null);
        if (exists && cloudData) {
          hasFetchedCloud.current = true;
          const cloudClients = Array.isArray(cloudData.clients) ? cloudData.clients : [];
          const localClients = Array.isArray(dataRef.current.clients) ? dataRef.current.clients : [];
          
          const merged = (cloudClients.length === 0 && localClients.length > 0)
            ? dataRef.current
            : mergeAppData(dataRef.current, cloudData);

          const currentHash = canonicalJson({ clients: dataRef.current.clients, charges: dataRef.current.charges, settings: dataRef.current.settings, sentLogs: dataRef.current.sentLogs });
          const mergedHash = canonicalJson({ clients: merged.clients, charges: merged.charges, settings: merged.settings, sentLogs: merged.sentLogs });
          
          if (currentHash !== mergedHash) {
            lastRemoteUpdateTimestamp.current = Date.now();
            isRemoteUpdate.current = true;
            setRawData(merged);
            lastSavedDataJsonRef.current = mergedHash;
            try { localStorage.setItem('gc_v1_data', JSON.stringify(merged)); } catch {}
          }
        } else if (!exists) {
          hasFetchedCloud.current = true;
          saveAppData(dataRef.current, 0).catch(() => {});
        }
      },
      (error) => {
        logger.warn('Sync stream notice:', error);
        if (error?.message?.includes('Quota exceeded') || error?.message?.includes('resource-exhausted')) {
          setSyncError('Cota diária gratuita do Firebase atingida (dados mantidos com segurança no aparelho)');
        }
      },
    );
    return () => unsubscribe();
  }, [syncTrigger]);

  // Non-blocking local persistence + debounced background cloud synchronization
  useEffect(() => {
    try {
      // 1. Immediately persist user changes to local device storage
      try {
        localStorage.setItem('gc_v1_data', JSON.stringify(data));
      } catch (e) {
        logger.error('Error saving localStorage:', e);
      }

      // 2. Guard against echoing remote cloud updates back to Firestore
      if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
      }

      if (!hasFetchedCloud.current) {
        return;
      }

      markHasPendingLocalChanges();

      // 3. Debounce cloud writes by 1500ms so multiple user actions don't saturate network
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        flushPendingDeletionsToFirestore().catch(() => {});
        saveAppData(dataRef.current).then(() => setSyncError(null)).catch((err) => {
          logger.warn('Save app data notice:', err);
          if (err?.message?.includes('Quota exceeded') || err?.message?.includes('resource-exhausted')) {
            setSyncError('Cota diária do Firebase atingida. Seus dados estão salvos no aparelho!');
          } else {
            setSyncError(err instanceof Error ? err.message : String(err));
          }
        });
      }, 1500);
    } catch (e) { logger.error('Error saving data:', e); }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data]);

  // Ensure any pending change is flushed before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveAppData(dataRef.current).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return null;
};
