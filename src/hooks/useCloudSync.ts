import { useEffect, useRef } from 'react';
import type { AppData } from '../types';
import { subscribeToApiData, saveAppData, mergeAppData, fetchAppData } from '../lib/api';
import type { LiveToast } from './useAppData';
import { checkAndTriggerDeviceNotifications } from '../utils/notifications';
import { markHasPendingLocalChanges, syncLocalStateToFirebase, flushPendingDeletionsToFirestore } from '../lib/offlineSyncManager';

import { logger } from '../lib/logger';
export const useCloudSync = ({
  data,
  dataRef,
  setRawData,
  setSyncTrigger,
  syncTrigger,
  isRemoteUpdate,
  lastSavedDataJsonRef,
  hasFetchedCloud,
  setSyncError,
  setLiveToast,
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
  setLiveToast: React.Dispatch<React.SetStateAction<LiveToast | null>>;
}) => {
  const lastRemoteUpdateTimestamp = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchAppData().then((res) => {
      if (res.exists && res.data) {
        hasFetchedCloud.current = true;
        lastRemoteUpdateTimestamp.current = Date.now();
        const merged = mergeAppData(dataRef.current, res.data);
        setRawData(merged);
        lastSavedDataJsonRef.current = JSON.stringify({ clients: merged.clients, charges: merged.charges, settings: merged.settings, sentLogs: merged.sentLogs });
        try { localStorage.setItem('gc_v1_data', JSON.stringify(merged)); } catch {}
        // Trigger initial notification check after load
        setTimeout(() => {
          checkAndTriggerDeviceNotifications(merged, setLiveToast);
        }, 1500);
      } else {
        hasFetchedCloud.current = true;
      }
    }).catch(() => {
      hasFetchedCloud.current = true;
    });
  }, []);

  useEffect(() => {
    const handleSyncReset = () => {
      // Auto flush pending local offline edits & deletions when coming back online
      syncLocalStateToFirebase(dataRef.current).then((success) => {
        if (success) setSyncError(null);
      }).catch(() => {});
      setSyncTrigger((prev) => prev + 1);
      if (dataRef.current) {
        checkAndTriggerDeviceNotifications(dataRef.current, setLiveToast);
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
  }, [setSyncTrigger, setLiveToast]);

  useEffect(() => {
    const unsubscribe = subscribeToApiData(
      (cloudData, exists) => {
        setSyncError(null);
        if (exists && cloudData) {
          hasFetchedCloud.current = true;
          lastRemoteUpdateTimestamp.current = Date.now();
          isRemoteUpdate.current = true;
          const merged = mergeAppData(dataRef.current, cloudData);
          setRawData(merged);
          lastSavedDataJsonRef.current = JSON.stringify({ clients: merged.clients, charges: merged.charges, settings: merged.settings, sentLogs: merged.sentLogs });
          try { localStorage.setItem('gc_v1_data', JSON.stringify(merged)); } catch {}
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

  // Synchronous local persistence + debounced background cloud synchronization
  useEffect(() => {
    try {
      // 1. Instant local persistence to device storage (0ms delay)
      localStorage.setItem('gc_v1_data', JSON.stringify(data));

      // 2. Guard against echoing remote cloud updates back to Firestore
      if (isRemoteUpdate.current || Date.now() - lastRemoteUpdateTimestamp.current < 2500) {
        isRemoteUpdate.current = false;
        return;
      }

      if (!hasFetchedCloud.current) return;

      const currentJson = JSON.stringify({ clients: data.clients, charges: data.charges, settings: data.settings, sentLogs: data.sentLogs });
      if (currentJson !== lastSavedDataJsonRef.current) {
        lastSavedDataJsonRef.current = currentJson;
        markHasPendingLocalChanges();

        // 3. Debounce cloud writes by 1200ms so multiple user actions don't saturate network
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
        }, 1200);
      }
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

  // Periodic device notifications check (every 60s instead of rapid 10s intervals)
  useEffect(() => {
    const interval = setInterval(() => {
      if (dataRef.current && document.visibilityState === 'visible') {
        checkAndTriggerDeviceNotifications(dataRef.current, setLiveToast);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [setLiveToast]);

  return null;
};
