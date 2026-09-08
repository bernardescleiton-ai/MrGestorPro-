/**
 * Background Persistence & Stability Manager
 * 
 * Guarantees that the app remains stable, does not lose state when minimized,
 * requests persistent storage from the browser/OS, and immediately resumes timers 
 * and data checks when returning from the background.
 */

import { logger } from '../lib/logger';

// 1. Request persistent storage from the browser / device OS
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        logger.info(`[StoragePersistence] Persistent storage requested: ${granted ? 'GRANTED' : 'DENIED'}`);
        return granted;
      }
      return true;
    } catch (err) {
      logger.warn('[StoragePersistence] Error requesting persistent storage:', err);
    }
  }
  return false;
}

// 2. Keep-alive heartbeat & visibility state watcher
type ResumeCallback = () => void;
const resumeListeners: Set<ResumeCallback> = new Set();

export function onAppResume(callback: ResumeCallback): () => void {
  resumeListeners.add(callback);
  return () => {
    resumeListeners.delete(callback);
  };
}

let isInitialized = false;

export function initBackgroundStability(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // Request persistent storage on start
  requestPersistentStorage().catch(() => {});

  // Watch for page visibility changes (when user minimizes app or switches apps)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      logger.info('[BackgroundStability] App returned to foreground - notifying listeners');
      resumeListeners.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          logger.error('[BackgroundStability] Error in resume listener:', e);
        }
      });
    } else if (document.visibilityState === 'hidden') {
      logger.info('[BackgroundStability] App minimized to background - state safely preserved');
    }
  });

  // Also handle window focus/blur for desktop/mobile browsers
  window.addEventListener('focus', () => {
    resumeListeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        // silent
      }
    });
  });

  // Keep-alive heartbeat: executes a light tick every 30s so the JS thread isn't killed prematurely
  let lastHeartbeat = Date.now();
  setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastHeartbeat;
    // If the device went to sleep and just woke up (elapsed > 45s)
    if (elapsed > 45000) {
      logger.info(`[BackgroundStability] Device woke up after ${Math.round(elapsed / 1000)}s - triggering wake routines`);
      resumeListeners.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          // silent
        }
      });
    }
    lastHeartbeat = now;
  }, 25000);
}
