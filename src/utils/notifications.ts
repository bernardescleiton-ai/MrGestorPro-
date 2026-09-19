import { AppData, CompanySettings, Client, Charge } from '../types';
import { getDefaultMessage, dateBR } from './formatters';
import {
  isNotificationSupported,
  isAndroidWebView,
  getNotificationPermissionStatus,
  requestDeviceNotificationPermission,
  playNotificationSound,
  dispatchNativeNotification,
} from './deviceNotificationBridge';
import { triggerOverdueDeviceNotifications } from './overdueNotificationTrigger';

export {
  isNotificationSupported,
  isAndroidWebView,
  getNotificationPermissionStatus,
  requestDeviceNotificationPermission,
  playNotificationSound,
  triggerOverdueDeviceNotifications,
};

export interface InAppAlertPayload {
  title: string;
  body: string;
  phone?: string;
  clientMessage?: string;
  client?: Client;
  charge?: Charge;
}

export interface NotificationRules {
  notify3DaysBefore: boolean;
  notify1DayBefore: boolean;
  notifyOnDueDate: boolean;
  notify1DayAfter: boolean;
}

export const defaultNotificationRules: NotificationRules = {
  notify3DaysBefore: true,
  notify1DayBefore: true,
  notifyOnDueDate: true,
  notify1DayAfter: true,
};

export async function showDeviceNotification(title: string, options?: NotificationOptions): Promise<boolean> {
  return await dispatchNativeNotification(title, options);
}

export async function sendTestNotification(): Promise<boolean> {
  const perm = getNotificationPermissionStatus();
  if (perm === 'default') {
    const granted = await requestDeviceNotificationPermission();
    if (!granted) return false;
  }
  return await showDeviceNotification('🔔 MrGestor: Teste de Notificação', {
    body: 'As notificações do seu aplicativo estão ativadas e funcionando perfeitamente!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'test-notification',
  });
}

function getTodayNotifiedMap(): Record<string, boolean> {
  try {
    const todayKey = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(`gc_notified_${todayKey}`);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setTodayNotifiedMap(map: Record<string, boolean>): void {
  try {
    const todayKey = new Date().toISOString().split('T')[0];
    localStorage.setItem(`gc_notified_${todayKey}`, JSON.stringify(map));
  } catch {
    // silent storage error
  }
}

interface ClientNotificationContext {
  client: Client;
  settings: CompanySettings;
  now: Date;
  today: Date;
  rules: NotificationRules;
  todayNotifiedMap: Record<string, boolean>;
  onInAppAlert?: (alert: InAppAlertPayload) => void;
}

function checkClientDueNotification(ctx: ClientNotificationContext): boolean {
  const { client, settings, now, today, rules, todayNotifiedMap, onInAppAlert } = ctx;
  if (!client.dueDate) return false;

  const clientMessage = getDefaultMessage(client, null, settings);
  let updated = false;

  if (client.dueDate.includes('T')) {
    const [datePart, timePart] = client.dueDate.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hh, mm] = (timePart || '00:00').split(':').map(Number);

    const targetDateTime = new Date(year, month - 1, day, hh || 0, mm || 0, 0, 0);
    const diffMs = now.getTime() - targetDateTime.getTime();

    if (diffMs >= 0 && diffMs <= 86400000) {
      const logKey = `client_exact_${client.id}_${client.dueDate}`;
      if (!todayNotifiedMap[logKey]) {
        const title = `⏰ VENCIMENTO AGORA: ${client.name}`;
        const body = `Vencimento programado para hoje às ${timePart} (${dateBR(datePart)}).`;

        void showDeviceNotification(title, {
          body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `client-exact-${client.id}`,
        });

        if (onInAppAlert) {
          onInAppAlert({ title, body, phone: client.phone, clientMessage, client });
        }

        todayNotifiedMap[logKey] = true;
        updated = true;
      }
    }
  }

  const rawDateStr = client.dueDate.includes('T') ? client.dueDate.split('T')[0] : client.dueDate;
  const [year, month, day] = rawDateStr.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day);
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
  let triggerReason: string | null = null;

  if (diffDays === 0 && rules.notifyOnDueDate && !client.dueDate.includes('T')) {
    triggerReason = `🚨 VENCIMENTO HOJE: ${client.name} (${dateBR(rawDateStr)})`;
  } else if (diffDays > 0 && diffDays <= 730 && rules.notify1DayAfter) {
    triggerReason = `⚠️ ATRASADO (${diffDays}d): ${client.name} (Venceu em ${dateBR(rawDateStr)})`;
  } else if (diffDays === -1 && rules.notify1DayBefore) {
    triggerReason = `📅 VENCE AMANHÃ: ${client.name} (${dateBR(rawDateStr)})`;
  } else if (diffDays === -3 && rules.notify3DaysBefore) {
    triggerReason = `📅 VENCE EM 3 DIAS: ${client.name} (${dateBR(rawDateStr)})`;
  }

  if (triggerReason) {
    const logKey = `client_day_${client.id}_${diffDays}`;
    if (!todayNotifiedMap[logKey]) {
      const title = triggerReason;
      const body = `Cliente: ${client.name} | Vencimento: ${dateBR(rawDateStr)}.`;

      void showDeviceNotification(title, {
        body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `client-${client.id}-${diffDays}`,
      });

      if (onInAppAlert) {
        onInAppAlert({ title, body, phone: client.phone, clientMessage, client });
      }

      todayNotifiedMap[logKey] = true;
      updated = true;
    }
  }

  return updated;
}

interface ChargeNotificationContext {
  charge: Charge;
  data: AppData;
  now: Date;
  today: Date;
  rules: NotificationRules;
  todayNotifiedMap: Record<string, boolean>;
  onInAppAlert?: (alert: InAppAlertPayload) => void;
}

function checkChargeDueNotification(ctx: ChargeNotificationContext): boolean {
  const { charge, data, now, today, rules, todayNotifiedMap, onInAppAlert } = ctx;
  if (charge.paid || !charge.dueDate || typeof charge.dueDate !== 'string') return false;

  const client = data.clients.find((c) => c.id === charge.clientId);
  const clientName = client ? client.name : 'Cliente';
  const clientPhone = client ? client.phone : undefined;
  const clientMessage = client ? getDefaultMessage(client, charge, data.settings) : '';

  const [year, month, day] = charge.dueDate.split('-').map(Number);
  let updated = false;

  if (charge.dueTime) {
    const [hh, mm] = charge.dueTime.split(':').map(Number);
    const targetDateTime = new Date(year, month - 1, day, hh || 0, mm || 0, 0, 0);
    const diffMs = now.getTime() - targetDateTime.getTime();

    if (diffMs >= 0 && diffMs <= 86400000) {
      const logKey = `charge_exact_${charge.id}_${charge.dueDate}_${charge.dueTime}`;
      if (!todayNotifiedMap[logKey]) {
        const title = `⏰ VENCIMENTO AGORA: ${clientName}`;
        const body = `Prazo/Vencimento às ${charge.dueTime} (${dateBR(charge.dueDate)}).`;

        void showDeviceNotification(title, {
          body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `charge-exact-${charge.id}`,
        });

        if (onInAppAlert) {
          onInAppAlert({ title, body, phone: clientPhone, clientMessage, client, charge });
        }

        todayNotifiedMap[logKey] = true;
        updated = true;
      }
    }
  }

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
      const title = triggerReason;
      const body = `Cliente: ${clientName} | Vencimento: ${dateBR(charge.dueDate)}.`;

      void showDeviceNotification(title, {
        body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: `charge-${charge.id}-${diffDays}`,
      });

      if (onInAppAlert) {
        onInAppAlert({ title, body, phone: clientPhone, clientMessage, client, charge });
      }

      todayNotifiedMap[logKey] = true;
      updated = true;
    }
  }

  return updated;
}

export function checkAndTriggerDeviceNotifications(
  data: AppData,
  onInAppAlert?: (alert: InAppAlertPayload) => void
): void {
  const rules = data.settings.notificationRules || defaultNotificationRules;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayNotifiedMap = getTodayNotifiedMap();
  let updatedLog = false;

  // 1. CHECK CLIENTS DUE DATES
  if (data.clients && data.clients.length > 0) {
    for (const client of data.clients) {
      if (checkClientDueNotification({ client, settings: data.settings, now, today, rules, todayNotifiedMap, onInAppAlert })) {
        updatedLog = true;
      }
    }
  }

  // 2. CHECK CHARGES DUE DATES
  if (data.charges && data.charges.length > 0) {
    for (const charge of data.charges) {
      if (checkChargeDueNotification({ charge, data, now, today, rules, todayNotifiedMap, onInAppAlert })) {
        updatedLog = true;
      }
    }
  }

  if (updatedLog) {
    setTodayNotifiedMap(todayNotifiedMap);
  }
}
