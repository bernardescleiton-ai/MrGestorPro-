import { Client, Charge, CompanySettings, SentMessageLog } from '../types';
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
  const fullDueDate = charge?.dueDate || client.dueDate || '';
  const dueDiff = fullDueDate ? getDaysUntilDue(fullDueDate) : null;
  const isOverdue = dueDiff !== null && dueDiff < 0;
  const isOverdue5Days = dueDiff !== null && dueDiff <= -5;

  const legacySettings = settings as Record<string, string | undefined>;
  const customOverdue5 = settings?.overdue5DaysMessageTemplate?.trim() || legacySettings?.templateExpired?.trim() || legacySettings?.overdueMessageTemplate?.trim();
  const customStandard = settings?.messageTemplate?.trim() || legacySettings?.templateDue?.trim();

  let tpl = '';
  if (isOverdue5Days && customOverdue5) {
    tpl = customOverdue5;
  } else if (customStandard) {
    tpl = customStandard;
  } else if (isOverdue && customOverdue5) {
    tpl = customOverdue5;
  } else {
    // Default fallback messages if user left template empty
    if (isOverdue) {
      tpl = 'Olá {nome}! Tudo bem?\n\nPassando para avisar que o seu vencimento cadastrado para {vencimento} está pendente.\n\nChave PIX: {pix}\n\nAtenciosamente, {empresa}.';
    } else {
      tpl = 'Olá {nome}! Tudo bem?\n\nPassando para lembrar sobre o seu vencimento cadastrado para: {vencimento}.\n\nChave PIX: {pix}\n\nAtenciosamente, {empresa}.';
    }
  }

  const dueStr = fullDueDate
    ? (fullDueDate.includes('T') || fullDueDate.includes(':') ? formatDateTimeBR(fullDueDate) : dateBR(fullDueDate))
    : 'a combinar';
  const valStr = charge?.amount ? brl(charge.amount) : '';
  const noteText = charge?.note || client.notes || '';
  const empresaStr = settings?.name || '';
  const pixStr = settings?.pixKey || '';
  const phoneStr = settings?.phone || '';
  const addressStr = settings?.address || '';

  let msg = tpl
    .replace(/{nome}|{cliente}/gi, () => client.name || '')
    .replace(/{vencimento}|{venc}|{data}/gi, () => dueStr)
    .replace(/{valor}|{quantia}/gi, () => valStr)
    .replace(/{empresa}/gi, () => empresaStr)
    .replace(/{pix}|{chavepix}|{chave_pix}/gi, () => pixStr)
    .replace(/{telefone}|{contato}|{whatsapp}/gi, () => phoneStr)
    .replace(/{endereco}/gi, () => addressStr)
    .replace(/{nota}|{observacao}|{obs}/gi, () => noteText);

  if (msg.includes('*vencimento*')) {
    msg = msg.replace(/\*vencimento\*/gi, () => `*${dueStr}*`);
  }
  if (msg.includes('*nome*') || msg.includes('*cliente*')) {
    msg = msg.replace(/\*nome\*|\*cliente\*/gi, () => `*${client.name}*`);
  }
  if (msg.includes('*valor*')) {
    msg = msg.replace(/\*valor\*/gi, () => (valStr ? `*${valStr}*` : ''));
  }
  if (msg.includes('*pix*')) {
    msg = msg.replace(/\*pix\*/gi, () => (pixStr ? `*${pixStr}*` : ''));
  }

  if (settings?.signature && settings.signature.trim() && !msg.includes(settings.signature.trim())) {
    msg += `\n\n${settings.signature.trim()}`;
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

import {
  buildClientLookupContext,
  resolveClientForCharge,
  cleanPhoneNumber,
  cleanClientName,
  ClientLookupContext,
} from './clientResolver';

export const deduplicatePaidCharges = (
  paidCharges: Charge[],
  clientMapOrContext: Map<string, Client> | ClientLookupContext,
  clients?: Client[],
  sentLogs?: SentMessageLog[]
): Charge[] => {
  if (!Array.isArray(paidCharges) || paidCharges.length === 0) return [];

  const ctx: ClientLookupContext =
    'idMap' in clientMapOrContext
      ? (clientMapOrContext as ClientLookupContext)
      : buildClientLookupContext(
          clients || Array.from(clientMapOrContext.values()),
          sentLogs
        );

  const bestChargeByClient = new Map<string, { charge: Charge; client: Client }>();

  for (let i = 0; i < paidCharges.length; i++) {
    const ch = paidCharges[i];
    if (!ch) continue;

    const cl = resolveClientForCharge(ch, ctx, clients, sentLogs);

    // If charge has NO matching client in clients, logs, or note, skip it so
    // it never pollutes the Completed tab with 'Cliente sem cadastro'
    if (!cl || !cl.name || cl.name.trim() === '') {
      continue;
    }

    const cleanPhone = cleanPhoneNumber(cl.phone);
    const cleanName = cleanClientName(cl.name);
    let clientKey = '';
    if (cleanPhone.length >= 8) {
      clientKey = `phone_${cleanPhone}`;
    } else if (cleanName) {
      clientKey = `name_${cleanName}`;
    } else if (cl.id) {
      clientKey = `id_${cl.id}`;
    }

    if (!clientKey) {
      continue;
    }

    // Ensure charge references the canonical client ID
    const normalizedCharge: Charge = ch.clientId === cl.id ? ch : { ...ch, clientId: cl.id };

    const existing = bestChargeByClient.get(clientKey);
    if (!existing) {
      bestChargeByClient.set(clientKey, { charge: normalizedCharge, client: cl });
    } else {
      const dateExisting = (existing.charge.dueDate || '') + (existing.charge.dueTime ? `T${existing.charge.dueTime}` : '');
      const dateCurrent = (normalizedCharge.dueDate || '') + (normalizedCharge.dueTime ? `T${normalizedCharge.dueTime}` : '');

      if (dateCurrent > dateExisting) {
        bestChargeByClient.set(clientKey, { charge: normalizedCharge, client: cl });
      } else if (dateCurrent === dateExisting) {
        const paidExisting = existing.charge.paidAt || existing.charge.createdAt || '';
        const paidCurrent = normalizedCharge.paidAt || normalizedCharge.createdAt || '';
        if (paidCurrent >= paidExisting) {
          bestChargeByClient.set(clientKey, { charge: normalizedCharge, client: cl });
        }
      }
    }
  }

  const result: Charge[] = [];
  for (const { charge: ch, client: cl } of bestChargeByClient.values()) {
    if (cl?.dueDate) {
      const [clientDate, clientTime] = cl.dueDate.includes('T') ? cl.dueDate.split('T') : [cl.dueDate, ''];
      const currentChargeDate = (ch.dueDate || '') + (ch.dueTime ? `T${ch.dueTime}` : '');
      const clientFullDate = clientDate + (clientTime ? `T${clientTime}` : '');

      if (clientFullDate > currentChargeDate) {
        result.push({
          ...ch,
          dueDate: clientDate,
          dueTime: clientTime || ch.dueTime || undefined,
        });
        continue;
      }
    }
    result.push(ch);
  }

  return result;
};
