import { AppData, Client, Charge } from '../types';
import { getDefaultMessage, dateBR } from './formatters';
import {
  isNotificationSupported,
  getNotificationPermissionStatus,
  requestDeviceNotificationPermission,
  showDeviceNotification,
} from './notifications';

function notifyOverdueClient(client: Client, settings: AppData['settings'], today: Date): boolean {
  if (!client.dueDate) return false;
  const clientMessage = getDefaultMessage(client, null, settings);
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
    const title = `⚠️ CLIENTE ATRASADO (${diffDays}d): ${client.name}`;
    const body = `Vencimento em ${dateFormatted}. WhatsApp: ${client.phone || 'Não informado'}`;
    void showDeviceNotification(title, {
      body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `overdue-client-${client.id}`,
    });
    return true;
  }
  if (diffDays === 0) {
    const title = `🚨 VENCIMENTO HOJE: ${client.name}`;
    const body = `Vencimento em ${dateFormatted}. WhatsApp: ${client.phone || 'Não informado'}`;
    void showDeviceNotification(title, {
      body: `${body}\n\n💬 Mensagem para o cliente:\n${clientMessage}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `today-client-${client.id}`,
    });
    return true;
  }
  return false;
}

function notifyOverdueCharge(charge: Charge, clients: Client[], settings: AppData['settings'], today: Date): boolean {
  if (charge.paid || !charge.dueDate) return false;
  const client = clients.find((c) => c.id === charge.clientId);
  const clientName = client ? client.name : 'Cliente';
  const clientMessage = client ? getDefaultMessage(client, charge, settings) : '';

  const [y, m, d] = charge.dueDate.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 3600 * 24));

  if (diffDays > 0) {
    const title = `⚠️ COBRANÇA ATRASADA (${diffDays}d): ${clientName}`;
    const body = `Vencimento: ${dateBR(charge.dueDate)}. ${charge.note ? `\nNota: ${charge.note}` : ''}`;
    void showDeviceNotification(title, {
      body: `${body}\n\n💬 Mensagem:\n${clientMessage}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `overdue-charge-${charge.id}`,
    });
    return true;
  }
  if (diffDays === 0) {
    const title = `🚨 COBRANÇA VENCE HOJE: ${clientName}`;
    const body = `Vencimento: ${dateBR(charge.dueDate)}. ${charge.note ? `\nNota: ${charge.note}` : ''}`;
    void showDeviceNotification(title, {
      body: `${body}\n\n💬 Mensagem:\n${clientMessage}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `today-charge-${charge.id}`,
    });
    return true;
  }
  return false;
}

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

  for (const client of data.clients || []) {
    if (notifyOverdueClient(client, data.settings, today)) count++;
  }

  for (const charge of data.charges || []) {
    if (notifyOverdueCharge(charge, data.clients, data.settings, today)) count++;
  }

  if (count === 0) {
    return { count: 0, message: 'Nenhum cliente ou cobrança em atraso ou vencendo hoje para notificar.' };
  }

  return { count, message: `${count} notificação(ões) enviada(s) para a barra do celular com sucesso!` };
}
