import { useEffect } from 'react';
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
  useEffect(() => {
    fetchAppData().then((res) => {
      if (res.exists && res.data) {
        hasFetchedCloud.current = true;
        const merged = mergeAppData(dataRef.current, res.data);
        setRawData(merged);
        lastSavedDataJsonRef.current = JSON.stringify({ clients: merged.clients, charges: merged.charges, settings: merged.settings, sentLogs: merged.sentLogs });
        try { localStorage.setItem('gc_v1_data', JSON.stringify(merged)); } catch {}
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
  }, [setSyncTrigger]);

  useEffect(() => {
    const unsubscribe = subscribeToApiData(
      (cloudData, exists) => {
        setSyncError(null);
        if (exists && cloudData) {
          hasFetchedCloud.current = true;
          const merged = mergeAppData(dataRef.current, cloudData);
          isRemoteUpdate.current = true;
          setRawData(merged);
          lastSavedDataJsonRef.current = JSON.stringify({ clients: merged.clients, charges: merged.charges, settings: merged.settings, sentLogs: merged.sentLogs });
          try { localStorage.setItem('gc_v1_data', JSON.stringify(merged)); } catch {}
          setTimeout(() => { isRemoteUpdate.current = false; }, 100);
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

  useEffect(() => {
    try {
      // 1. Instant local persistence to device storage
      localStorage.setItem('gc_v1_data', JSON.stringify(data));
      markHasPendingLocalChanges();

      if (!hasFetchedCloud.current) return;
      const currentJson = JSON.stringify({ clients: data.clients, charges: data.charges, settings: data.settings, sentLogs: data.sentLogs });
      if (currentJson !== lastSavedDataJsonRef.current) {
        lastSavedDataJsonRef.current = currentJson;
        // 2. Sync to Firebase
        flushPendingDeletionsToFirestore().catch(() => {});
        saveAppData(data).then(() => setSyncError(null)).catch((err) => {
          logger.warn('Save app data notice:', err);
          if (err?.message?.includes('Quota exceeded') || err?.message?.includes('resource-exhausted')) setSyncError('Cota diária do Firebase atingida. Seus dados estão salvos no aparelho!');
          else setSyncError(err instanceof Error ? err.message : String(err));
        });
      }
      checkAndTriggerDeviceNotifications(data, setLiveToast);
    } catch (e) { logger.error('Error saving data:', e); }
  }, [data]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (dataRef.current) checkAndTriggerDeviceNotifications(dataRef.current, setLiveToast);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return null;
};
