import { logger } from '../lib/logger';

// Native Bridge Interface for Android/iOS WebViews
interface NativeBridgeWindow {
  Android?: { showNotification?: (title: string, body: string) => void };
  AndroidInterface?: { showNotification?: (title: string, body: string) => void };
  AndroidBridge?: { postMessage?: (msg: string) => void };
  JsBridge?: { postMessage?: (msg: string) => void };
  Capacitor?: unknown;
  Cordova?: unknown;
}

export function isNotificationSupported(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as NativeBridgeWindow;
    if ('Notification' in window) return true;
    if (win.Android || win.AndroidInterface || win.AndroidBridge || win.Capacitor || win.Cordova || win.JsBridge) return true;
    return false;
  } catch {
    return false;
  }
}

export function isAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const win = window as unknown as NativeBridgeWindow;
  return (
    /wv|WebView|Android.*Build\/|Version\/.*Chrome/i.test(ua) ||
    Boolean(win.Android || win.AndroidInterface || win.AndroidBridge || win.Capacitor || win.Cordova || win.JsBridge)
  );
}

export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  const win = window as unknown as NativeBridgeWindow;
  if (win.Android || win.AndroidInterface || win.AndroidBridge || win.Capacitor || win.Cordova) {
    return 'granted';
  }
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function requestDeviceNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    logger.error('Error requesting notification permission:', err);
    return false;
  }
}

let sharedAudioCtx: AudioContext | null = null;
let lastSoundPlayTime = 0;

export function playNotificationSound(): void {
  const nowMs = Date.now();
  if (nowMs - lastSoundPlayTime < 3000) return; // Throttle to prevent audio thread lock
  lastSoundPlayTime = nowMs;

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (err) {
    logger.debug('Audio chime failed:', err);
  }
}

export async function dispatchNativeNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  playNotificationSound();
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // ignore vibration errors
    }
  }

  // 1. Try Native Android / iOS Bridge
  if (typeof window !== 'undefined') {
    const win = window as unknown as NativeBridgeWindow;
    if (win.Android && typeof win.Android.showNotification === 'function') {
      try {
        win.Android.showNotification(title, options?.body || '');
        return true;
      } catch (e) {
        logger.warn('Android.showNotification bridge call failed:', e);
      }
    }
    if (win.AndroidInterface && typeof win.AndroidInterface.showNotification === 'function') {
      try {
        win.AndroidInterface.showNotification(title, options?.body || '');
        return true;
      } catch (e) {
        logger.warn('AndroidInterface.showNotification bridge call failed:', e);
      }
    }
    if (win.AndroidBridge && typeof win.AndroidBridge.postMessage === 'function') {
      try {
        win.AndroidBridge.postMessage(JSON.stringify({ action: 'notification', title, body: options?.body || '' }));
        return true;
      } catch {
        // silent
      }
    }
    if (win.JsBridge && typeof win.JsBridge.postMessage === 'function') {
      try {
        win.JsBridge.postMessage(JSON.stringify({ action: 'notification', title, body: options?.body || '' }));
        return true;
      } catch {
        // silent
      }
    }
  }

  // 2. Try Service Worker Registration
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js').catch(async () => {
          return await navigator.serviceWorker.register('./sw.js').catch(() => undefined);
        });
      }
      if (!reg) {
        reg = await navigator.serviceWorker.ready.catch(() => undefined);
      }
      if (reg && typeof reg.showNotification === 'function') {
        const swOptions: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
          vibrate: [200, 100, 200],
          badge: '/icon-192.png',
          icon: '/icon-192.png',
          renotify: true,
          ...options,
        };
        await reg.showNotification(title, swOptions);
        return true;
      }
    } catch (swErr) {
      logger.warn('ServiceWorker showNotification attempt failed:', swErr);
    }
  }

  // 3. Fallback to standard Notification constructor
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });
      return true;
    } catch (err) {
      logger.warn('Standard Notification constructor not available:', err);
      return false;
    }
  }

  return false;
}
