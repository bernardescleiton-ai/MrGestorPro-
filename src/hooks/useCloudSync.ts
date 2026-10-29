import { useEffect, useRef } from 'react';
import type { AppData } from '../types';
import { saveAppData, mergeAppData, fetchAppData, sanitizeAppData } from '../lib/api';
import { logger } from '../lib/logger';

export const useCloudSync = ({
  data,
  dataRef,
  setRawData,
  isRemoteUpdate,
  hasFetchedCloud,
  setSyncError,
}: {
  data: AppData;
  dataRef: React.MutableRefObject<AppData>;
  setRawData: React.Dispatch<React.SetStateAction<AppData>>;
  setSyncTrigger?: React.Dispatch<React.SetStateAction<number>>;
  syncTrigger?: number;
  isRemoteUpdate: React.MutableRefObject<boolean>;
  hasFetchedCloud: React.MutableRefObject<boolean>;
  lastSavedDataJsonRef?: React.MutableRefObject<string>;
  setSyncError: (value: string | null) => void;
  setLiveToast?: unknown;
}) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load: Disabled to enforce local-only data persistence
  useEffect(() => {
    hasFetchedCloud.current = true;
  }, []);

  // 2. Continuous persistence: update localStorage immediately and save to server
  useEffect(() => {
    try {
      localStorage.setItem('gc_v1_data', JSON.stringify(data));
    } catch (e) {
      logger.error('Error saving localStorage in useCloudSync:', e);
    }

    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    if (!hasFetchedCloud.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      logger.info('Triggering background save for', dataRef.current.clients.length, 'clients.');
      saveAppData(dataRef.current)
        .then(() => {
          logger.info('Background save completed successfully.');
          setSyncError(null);
        })
        .catch((err) => {
          logger.error('Background save FAILED:', err);
        });
    }, 300);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data]);

  // 3. Flush pending changes immediately on beforeunload and tab hide
  useEffect(() => {
    const flushNow = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveAppData(dataRef.current).catch(() => {});
    };

    window.addEventListener('beforeunload', flushNow);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', flushNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return null;
};
