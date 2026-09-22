import { Client, Charge, CompanySettings } from '../types';
import { encodeForWhatsApp, openWhatsAppLink, openDirectWhatsApp } from './whatsappHelpers';
import {
  parseAnyDateToParts,
  dateBR,
  todayStr,
  daysBetween,
  formatDateTimeBR,
  getDaysUntilDue,
  getOverdueChargeClientIds,
  isClientActive,
  getClientStatusBadge,
  getChargeStatus,
  formatDateForDisplay,
  formatForDateTimeInput,
  formatDateForInput,
  formatTimeForInput,
  calculateRenewalDueDate,
} from './dateFormatters';

export {
  encodeForWhatsApp,
  openWhatsAppLink,
  openDirectWhatsApp,
  parseAnyDateToParts,
  dateBR,
  todayStr,
  daysBetween,
  formatDateTimeBR,
  getDaysUntilDue,
  getOverdueChargeClientIds,
  isClientActive,
  getClientStatusBadge,
  getChargeStatus,
  formatDateForDisplay,
  formatForDateTimeInput,
  formatDateForInput,
  formatTimeForInput,
  calculateRenewalDueDate,
};

export const brl = (v: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
};

export const normalizePhone = (p: string): string => {
  if (!p) return '';
  return p.replace(/\D/g, '');
};

export const formatPhoneBR = (phone: string): string => {
  return formatPhoneNumber(phone);
};

export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  const trimmed = String(phone).trim();
  const digits = normalizePhone(trimmed);
  if (!digits) return phone;

  const hasPlus = trimmed.startsWith('+');

  // 1. Brazil with 55
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    if (num.length === 9) {
      return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    return `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }

  // 2. Brazil local without 55
  if (digits.length === 10 || digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    if (num.length === 9) {
      return `${hasPlus ? '+55 ' : ''}(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    }
    return `${hasPlus ? '+55 ' : ''}(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }

  // 3. Portugal with 351
  if (digits.startsWith('351') && digits.length === 12) {
    const num = digits.slice(3);
    return `+351 ${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6)}`;
  }

  // 4. USA / Canada with 1
  if (digits.startsWith('1') && digits.length === 11) {
    const area = digits.slice(1, 4);
    const first = digits.slice(4, 7);
    const last = digits.slice(7);
    return `+1 (${area}) ${first}-${last}`;
  }

  // 5. General fallback
  if (digits.length >= 8 && digits.length <= 15) {
    if (hasPlus) return `+${digits}`;
    return digits;
  }

  return phone;
};

export const getDefaultMessage = (client: Client, charge: Charge | null | undefined, settings: CompanySettings): string => {
  const chargeDiff = charge && !charge.paid && charge.dueDate ? getDaysUntilDue(charge.dueDate) : null;
  const isExpired = chargeDiff !== null && chargeDiff < 0;
  const tpl = isExpired && settings?.templateExpired ? settings.templateExpired : (settings?.templateDue || 'Olá {nome}, seu vencimento é dia {vencimento}.');

  const fullDueDate = charge?.dueDate || client.dueDate || '';
  const dueStr = fullDueDate ? dateBR(fullDueDate) : 'a combinar';
  const valStr = charge ? brl(charge.amount) : 'R$ 0,00';
  const noteText = charge?.note || client.notes || '';

  let msg = tpl
    .replace(/{nome}|{cliente}/gi, () => client.name)
    .replace(/{vencimento}/gi, () => dueStr)
    .replace(/{valor}/gi, () => valStr)
    .replace(/{empresa}/gi, () => settings?.name || 'Nossa Empresa')
    .replace(/{pix}/gi, () => settings?.pixKey || '')
    .replace(/{telefone}|{contato}/gi, () => settings?.phone || '')
    .replace(/{nota}|{observacao}/gi, () => noteText || '');

  if (msg.includes('*vencimento*')) {
    msg = msg.replace(/\*vencimento\*/gi, () => `*${dueStr}*`);
  }
  if (msg.includes('*nome*') || msg.includes('*cliente*')) {
    msg = msg.replace(/\*nome\*|\*cliente\*/gi, () => `*${client.name}*`);
  }

  if (settings?.signature) {
    msg += `\n\n${settings.signature}`;
  }
  return msg;
};

export const openWhatsApp = (client: Client, charge: Charge | null | undefined, settings: CompanySettings): void => {
  const text = getDefaultMessage(client, charge, settings);
  openWhatsAppLink(client.phone, text, settings);
};

export const deduplicateClients = (clients: Client[]): Client[] => {
  if (!Array.isArray(clients)) return [];
  const seen = new Set<string>();
  const unique: Client[] = [];

  for (const c of clients) {
    if (!c) continue;
    const cleanPhone = (c.phone || '').replace(/\D/g, '').replace(/^55/, '');
    const cleanName = (c.name || '').trim().toLowerCase();
    const key = c.id ? `id_${c.id}` : `np_${cleanName}_${cleanPhone}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
};

export const formatClientForCopy = (c: Client): string => {
  if (!c) return '';
  const cleanName = (c.name || '').trim();
  const rawDate = c.dueDate ? c.dueDate.split('T')[0] : '';
  const dateStr = rawDate ? dateBR(rawDate) : '';
  const cleanPhone = (c.phone || '').replace(/\D/g, '');
  return `${cleanName}\n${dateStr}\n${cleanPhone}`;
};

export const formatClientsListForCopy = (clients: Client[]): string => {
  const uniqueClients = deduplicateClients(clients);
  return uniqueClients.map(formatClientForCopy).filter(Boolean).join('\n\n');
};
