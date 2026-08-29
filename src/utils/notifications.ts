import { AppData, NotificationRules, Client, Charge } from '../types';
import { dateBR, todayStr, formatDateTimeBR, getDefaultMessage } from './formatters';

const NOTIFIED_LOG_KEY = 'gc_notified_log_v1';

export const defaultNotificationRules: NotificationRules = {
  enabled: true,
  notifyOnDueDate: true,
  notify1DayBefore: true,
  notify3DaysBefore: true,
  notify1DayAfter: true,
  notify3DaysAfter: true,
};

// Check if browser supports Notification API or Android WebView Native Interface
export function isNotificationSupported(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const win = window as any;
    // Check standard Notification API OR native Android JS Bridge
    if ('Notification' in window) return true;
    if (win.Android || win.AndroidInterface || win.AndroidBridge || win.Capacitor || win.Cordova || win.JsBridge) return true;
    return false;
  } catch {
    return false;
  }
}

// Detect if running inside an Android APK / WebView wrapper
export function isAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const win = window as any;
  return (
    /wv|WebView|Android.*Build\/|Version\/.*Chrome/i.test(ua) ||
    !!(win.Android || win.AndroidInterface || win.AndroidBridge || win.Capacitor || win.Cordova || win.JsBridge)
  );
}

// Get current permission status
export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  const win = window as any;
  if (win.Android || win.AndroidInterface || win.AndroidBridge || win.Capacitor || win.Cordova) {
    return 'granted';
  }
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return Notification.permission;
  } catch (err) {
    return 'unsupported';
  }
}

// Request permission from browser/phone
export async function requestDeviceNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    // Register ServiceWorker first if available
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

// Play pleasant web audio chime
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    const now = ctx.currentTime;
    // Two-tone chime: D5 (587.33Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {
    console.debug('Audio chime failed:', e);
  }
}

// Helper to safely trigger notification using ServiceWorker registration or Notification constructor fallback
export async function showDeviceNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  // Always trigger sound & vibration
  playNotificationSound();
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {}
  }

  // 0. Try Native Android / iOS Bridge Interface if running inside an APK wrapper
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.Android && typeof win.Android.showNotification === 'function') {
      try {
        win.Android.showNotification(title, options?.body || '');
        return true;
      } catch (e) {
        console.warn('Android.showNotification bridge call failed:', e);
      }
    }
    if (win.AndroidInterface && typeof win.AndroidInterface.showNotification === 'function') {
      try {
        win.AndroidInterface.showNotification(title, options?.body || '');
        return true;
      } catch (e) {
        console.warn('AndroidInterface.showNotification bridge call failed:', e);
      }
    }
    if (win.AndroidBridge && typeof win.AndroidBridge.postMessage === 'function') {
      try {
        win.AndroidBridge.postMessage(JSON.stringify({ action: 'notification', title, body: options?.body || '' }));
        return true;
      } catch (e) {}
    }
    if (win.JsBridge && typeof win.JsBridge.postMessage === 'function') {
      try {
        win.JsBridge.postMessage(JSON.stringify({ action: 'notification', title, body: options?.body || '' }));
        return true;
      } catch (e) {}
    }
  }

  // 1. Try Service Worker Registration (Required on Android, Chrome Mobile, and modern PWA contexts)
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
      console.warn('ServiceWorker showNotification attempt failed:', swErr);
    }
  }

  // 2. Fallback to standard Notification constructor (Desktop browsers)
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options,
      });
      return true;
    } catch (err) {
      console.warn('Standard Notification constructor not available in this environment:', err);
      return false;
    }
  }

  return false;
}

// Send immediate test notification
export async function sendTestNotification(): Promise<boolean> {
  if (!isNotificationSupported()) {
    alert('Seu navegador ou dispositivo não possui suporte a Notificações Nativas.');
    return false;
  }

  if (Notification.permission !== 'granted') {
    alert('Permissão para notificações não concedida. Por favor, clique em "Permitir Notificações" primeiro.');
    return false;
  }

  const title = '🔔 Alerta MrGestor';
  const body = 'Notificações ativas com sucesso! Você receberá alertas dos vencimentos de clientes neste dispositivo.';

  const success = await showDeviceNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  });

  if (!success) {
    alert('Não foi possível disparar a notificação.');
  }
  return success;
}

// Get notified items map for today from localStorage
function getTodayNotifiedMap(): Record<string, boolean> {
  const todayKey = `${NOTIFIED_LOG_KEY}_${todayStr()}`;
  try {
    const data = localStorage.getItem(todayKey);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save notified items map for today
function setTodayNotifiedMap(map: Record<string, boolean>) {
  const todayKey = `${NOTIFIED_LOG_KEY}_${todayStr()}`;
  try {
    localStorage.setItem(todayKey, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving notification log:', e);
  }
}

// Main function to check and trigger device notifications
export async function checkAndTriggerDeviceNotifications(
  data: AppData,
  onInAppAlert?: (alertData: {
    title: string;
    body: string;
    phone?: string;
    clientMessage?: string;
    client?: Client;
    charge?: Charge;
  }) => void
) {
  const rules = data.settings.notificationRules || defaultNotificationRules;
  if (!rules.enabled) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todayNotifiedMap = getTodayNotifiedMap();
  let updatedLog = false;

  // 1. CHECK CLIENT DUE DATES (Real-time and Daily)
  if (data.clients && data.clients.length > 0) {
    for (const client of data.clients) {
      if (!client.dueDate || typeof client.dueDate !== 'string') continue;

      let targetDate: Date;
      let hasExactTime = false;
      let dateFormatted = '';

      if (client.dueDate.includes('T')) {
        const [datePart, timePart] = client.dueDate.split('T');
        const [y, m, d] = datePart.split('-').map(Number);
        const [hh, mm] = (timePart || '00:00').split(':').map(Number);
        targetDate = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
        hasExactTime = true;
        dateFormatted = `${dateBR(datePart)}${timePart ? ` às ${timePart}` : ''}`;
      } else {
        const [y, m, d] = client.dueDate.split('-').map(Number);
        targetDate = new Date(y, m - 1, d, 0, 0, 0, 0);
        dateFormatted = dateBR(client.dueDate);
      }

      const clientMessage = getDefaultMessage(client, null, data.settings);

      if (hasExactTime) {
        // Real-time check: has the exact time arrived? (within the past 24h)
        const diffMs = now.getTime() - targetDate.getTime();
        if (diffMs >= 0 && diffMs <= 86400000) {
          const logKey = `client_exact_${client.id}_${client.dueDate}`;
          if (!todayNotifiedMap[logKey]) {
            const title = `⏰ VENCIMENTO DO CLIENTE: ${client.name}`;
            const body = `Horário para ${dateFormatted} atingido! WhatsApp: ${client.phone}`;
            
            showDeviceNotification(title, {
              body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `client-${client.id}`,
            });

            if (onInAppAlert) {
              onInAppAlert({ title, body, phone: client.phone, clientMessage, client });
            }

            todayNotifiedMap[logKey] = true;
            updatedLog = true;
          }
        }
      } else {
        // Calendar day check
        const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 0 && rules.notifyOnDueDate) {
          const logKey = `client_day_${client.id}_${client.dueDate}_0`;
          if (!todayNotifiedMap[logKey]) {
            const title = `🚨 VENCIMENTO HOJE: ${client.name}`;
            const body = `Cliente com vencimento hoje (${dateFormatted}). WhatsApp: ${client.phone}`;

            showDeviceNotification(title, {
              body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `client-day-${client.id}`,
            });

            if (onInAppAlert) {
              onInAppAlert({ title, body, phone: client.phone, clientMessage, client });
            }

            todayNotifiedMap[logKey] = true;
            updatedLog = true;
          }
        } else if (diffDays > 0 && diffDays <= 730 && rules.notify1DayAfter) {
          const logKey = `client_overdue_${client.id}_${client.dueDate}`;
          if (!todayNotifiedMap[logKey]) {
            const title = `⚠️ CLIENTE ATRASADO (${diffDays}d): ${client.name}`;
            const body = `Vencimento em ${dateFormatted}. WhatsApp: ${client.phone}`;

            showDeviceNotification(title, {
              body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `client-overdue-${client.id}`,
            });

            if (onInAppAlert) {
              onInAppAlert({ title, body, phone: client.phone, clientMessage, client });
            }

            todayNotifiedMap[logKey] = true;
            updatedLog = true;
          }
        }
      }
    }
  }

  // 2. CHECK CHARGES DUE DATES (Real-time and Daily)
  if (data.charges && data.charges.length > 0) {
    for (const charge of data.charges) {
      if (charge.paid) continue;

      const client = data.clients.find((c) => c.id === charge.clientId);
      const clientName = client ? client.name : 'Cliente';
      const clientPhone = client ? client.phone : undefined;

      const clientMessage = client ? getDefaultMessage(client, charge, data.settings) : '';

      if (!charge.dueDate || typeof charge.dueDate !== 'string') continue;

      const [year, month, day] = charge.dueDate.split('-').map(Number);

      // Check exact time if charge.dueTime is set
      if (charge.dueTime) {
        const [hh, mm] = charge.dueTime.split(':').map(Number);
        const targetDateTime = new Date(year, month - 1, day, hh || 0, mm || 0, 0, 0);
        const diffMs = now.getTime() - targetDateTime.getTime();

        if (diffMs >= 0 && diffMs <= 86400000) {
          const logKey = `charge_exact_${charge.id}_${charge.dueDate}_${charge.dueTime}`;
          if (!todayNotifiedMap[logKey]) {
            const title = `⏰ VENCIMENTO AGORA: ${clientName}`;
            const body = `Prazo/Vencimento às ${charge.dueTime} (${dateBR(charge.dueDate)}).`;

            showDeviceNotification(title, {
              body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: `charge-exact-${charge.id}`,
            });

            if (onInAppAlert) {
              onInAppAlert({ title, body, phone: clientPhone, clientMessage, client, charge });
            }

            todayNotifiedMap[logKey] = true;
            updatedLog = true;
          }
        }
      }

      // Check calendar days differences
      const dueDate = new Date(year, month - 1, day);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));

      let triggerReason: string | null = null;

      if (diffDays === 0 && rules.notifyOnDueDate && !charge.dueTime) {
        triggerReason = `🚨 VENCIMENTO HOJE: ${clientName} (${dateBR(charge.dueDate)})`;
      } else if (diffDays > 0 && diffDays <= 730 && rules.notify1DayAfter) {
        triggerReason = `⚠️ ATRASADO (${diffDays}d): ${clientName} (Venceu em ${dateBR(charge.dueDate)})`;
      } else if (diffDays === -1 && rules.notify1DayBefore) {
        triggerReason = `📅 VENCE AMANHÃ: ${clientName} (${dateBR(charge.dueDate)})`;
      } else if (diffDays === -3 && rules.notify3DaysBefore) {
        triggerReason = `📅 VENCE EM 3 DIAS: ${clientName} (${dateBR(charge.dueDate)})`;
      }

      if (triggerReason) {
        const logKey = `charge_day_${charge.id}_${diffDays}`;
        if (!todayNotifiedMap[logKey]) {
          const title = `${triggerReason}`;
          const body = `Cliente: ${clientName} | Vencimento: ${dateBR(charge.dueDate)}.`;

          showDeviceNotification(title, {
            body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `charge-${charge.id}-${diffDays}`,
          });

          if (onInAppAlert) {
            onInAppAlert({ title, body, phone: clientPhone, clientMessage, client, charge });
          }

          todayNotifiedMap[logKey] = true;
          updatedLog = true;
        }
      }
    }
  }

  if (updatedLog) {
    setTodayNotifiedMap(todayNotifiedMap);
  }
}

// Force sending notifications to the device status bar / notification panel for all overdue clients/charges
export async function triggerOverdueDeviceNotifications(data: AppData): Promise<{ count: number; message: string }> {
  if (!isNotificationSupported()) {
    return { count: 0, message: 'Seu navegador ou dispositivo não suporta notificações nativas.' };
  }

  let perm = getNotificationPermissionStatus();
  if (perm === 'default') {
    const granted = await requestDeviceNotificationPermission();
    perm = granted ? 'granted' : 'denied';
  }

  if (perm !== 'granted') {
    return {
      count: 0,
      message: 'Permissão para notificações não foi concedida. Por favor, permita as notificações nas configurações do seu navegador ou celular.',
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;

  // 1. Check Clients
  if (data.clients && data.clients.length > 0) {
    for (const client of data.clients) {
      if (!client.dueDate) continue;
      const clientMessage = getDefaultMessage(client, null, data.settings);

      let targetDate: Date;
      let dateFormatted = '';

      if (client.dueDate.includes('T')) {
        const [datePart, timePart] = client.dueDate.split('T');
        const [y, m, d] = datePart.split('-').map(Number);
        targetDate = new Date(y, m - 1, d);
        dateFormatted = `${dateBR(datePart)}${timePart ? ` às ${timePart}` : ''}`;
      } else {
        const [y, m, d] = client.dueDate.split('-').map(Number);
        targetDate = new Date(y, m - 1, d);
        dateFormatted = dateBR(client.dueDate);
      }

      const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays > 0) {
        // Overdue
        const title = `⚠️ CLIENTE ATRASADO (${diffDays}d): ${client.name}`;
        const body = `Vencimento em ${dateFormatted}. WhatsApp: ${client.phone || 'Não informado'}`;
        await showDeviceNotification(title, {
          body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `overdue-client-${client.id}`,
        });
        count++;
      } else if (diffDays === 0) {
        // Due today
        const title = `🚨 VENCIMENTO HOJE: ${client.name}`;
        const body = `Vencimento em ${dateFormatted}. WhatsApp: ${client.phone || 'Não informado'}`;
        await showDeviceNotification(title, {
          body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `today-client-${client.id}`,
        });
        count++;
      }
    }
  }

  // 2. Check Charges
  if (data.charges && data.charges.length > 0) {
    for (const charge of data.charges) {
      if (charge.paid || !charge.dueDate) continue;
      const client = data.clients.find((c) => c.id === charge.clientId);
      const clientName = client ? client.name : 'Cliente';
      const clientMessage = client ? getDefaultMessage(client, charge, data.settings) : '';

      const [y, m, d] = charge.dueDate.split('-').map(Number);
      const targetDate = new Date(y, m - 1, d);
      const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays > 0) {
        const title = `⚠️ COBRANÇA ATRASADA (${diffDays}d): ${clientName}`;
        const body = `Vencimento: ${dateBR(charge.dueDate)}. ${charge.note ? `\nNota: ${charge.note}` : ''}`;
        await showDeviceNotification(title, {
          body: `${body}\n\n💬 Mensagem:\n${clientMessage}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `overdue-charge-${charge.id}`,
        });
        count++;
      } else if (diffDays === 0) {
        const title = `🚨 COBRANÇA VENCE HOJE: ${clientName}`;
        const body = `Vencimento: ${dateBR(charge.dueDate)}. ${charge.note ? `\nNota: ${charge.note}` : ''}`;
        await showDeviceNotification(title, {
          body: `${body}\n\n💬 Mensagem:\n${clientMessage}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `today-charge-${charge.id}`,
        });
        count++;
      }
    }
  }

  if (count === 0) {
    return { count: 0, message: 'Nenhum cliente ou cobrança em atraso ou vencendo hoje para notificar.' };
  }

  return { count, message: `${count} notificação(ões) enviada(s) para a barra do celular com sucesso!` };
}

