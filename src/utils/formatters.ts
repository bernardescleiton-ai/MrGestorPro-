import { Client, Charge, CompanySettings } from '../types';
import { encodeForWhatsApp, openWhatsAppLink, openDirectWhatsApp } from './whatsappHelpers';

export { encodeForWhatsApp, openWhatsAppLink, openDirectWhatsApp };

export const brl = (v: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
};

export const dateBR = (s: string): string => {
  if (!s || typeof s !== 'string') return '';
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');
};

export const todayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizePhone = (p: string): string => {
  if (!p) return '';
  return p.replace(/\D/g, '');
};

export const formatPhoneBR = (phone: string): string => {
  const digits = normalizePhone(phone);
  if (!digits) return '';
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

export type ChargeStatus = 'pending' | 'paid' | 'late';

export const getChargeStatus = (c: Charge): ChargeStatus => {
  if (c.paid) return 'paid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(c.dueDate + 'T12:00:00');
  return due < today ? 'late' : 'pending';
};

export const calculateRenewalDueDate = (currentDueDate: string | undefined, monthsToAdd: number): string => {
  const now = new Date();
  let baseDate = new Date();
  let hours = String(now.getHours()).padStart(2, '0');
  let minutes = String(now.getMinutes()).padStart(2, '0');

  if (currentDueDate) {
    const parsed = new Date(currentDueDate);
    if (!isNaN(parsed.getTime())) {
      hours = String(parsed.getHours()).padStart(2, '0');
      minutes = String(parsed.getMinutes()).padStart(2, '0');

      if (parsed > now) {
        baseDate = new Date(parsed.getTime());
      } else {
        baseDate = new Date(now.getTime());
      }
    }
  }

  const nextDate = new Date(baseDate.getTime());
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);

  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, '0');
  const day = String(nextDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const getDefaultMessage = (
  client: Client,
  charge: Charge | null | undefined,
  settings: CompanySettings,
  templateTypeOverride?: 'standard' | 'overdue_5_days'
): string => {
  const dateToEvaluate = charge?.dueDate || client?.dueDate?.split('T')[0];
  const daysDiff = getDaysUntilDue(dateToEvaluate);
  const isOverdue5Days = templateTypeOverride === 'overdue_5_days' || (templateTypeOverride !== 'standard' && daysDiff !== null && daysDiff <= -5);

  let template = '';
  if (isOverdue5Days && settings?.overdue5DaysMessageTemplate && settings.overdue5DaysMessageTemplate.trim()) {
    template = settings.overdue5DaysMessageTemplate;
  } else if (isOverdue5Days && (!settings?.messageTemplate || !settings.messageTemplate.trim())) {
    template = 'Olá, {nome}! Notamos que seu vencimento do dia *{vencimento}* está pendente há mais de 5 dias.\n\nPedimos por gentileza que regularize sua pendência para evitarmos o cancelamento do serviço.{nota}\n\nChave PIX: {pix}';
  } else if (settings?.messageTemplate && settings.messageTemplate.trim()) {
    template = settings.messageTemplate;
  } else {
    template = 'Olá, {nome}! Tudo bem?\n\nPassando para lembrar que seu vencimento está agendado para o dia *{vencimento}*.{nota}';
  }

  const dueStr = charge ? (charge.dueTime ? `${dateBR(charge.dueDate)} às ${charge.dueTime}` : dateBR(charge.dueDate)) : (client.dueDate ? formatDateTimeBR(client.dueDate) : 'a definir');
  const noteText = charge?.note ? `\nObservação: ${charge.note}` : '';
  const amountText = charge?.amount ? `R$ ${charge.amount.toFixed(2).replace('.', ',')}` : '';

  let msg = template;

  msg = msg
    .replace(/{nome}|{cliente}/gi, () => client.name || '')
    .replace(/{vencimento}|{venc}|{data}/gi, () => dueStr || '')
    .replace(/{valor}|{quantia}/gi, () => amountText || '')
    .replace(/{empresa}/gi, () => settings?.name || '')
    .replace(/{pix}/gi, () => settings?.pixKey || '')
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

export const formatDateTimeBR = (isoStr?: string): string => {
  if (!isoStr) return '—';
  const [datePart, timePart] = isoStr.split('T');
  if (!datePart) return isoStr;
  const formattedDate = dateBR(datePart);
  return timePart ? `${formattedDate} às ${timePart}` : formattedDate;
};

// High performance cached date calculations
let cachedTodayKey = '';
let cachedTodayResetMs = 0;
const daysUntilDueCache = new Map<string, number | null>();
const statusBadgeCache = new Map<string, { label: string; className: string }>();

function getTodayResetMs(): number {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  if (todayKey !== cachedTodayKey) {
    cachedTodayKey = todayKey;
    cachedTodayResetMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    daysUntilDueCache.clear();
    statusBadgeCache.clear();
  }
  return cachedTodayResetMs;
}

export const getDaysUntilDue = (dueDateStr?: string): number | null => {
  if (!dueDateStr || typeof dueDateStr !== 'string') return null;
  getTodayResetMs();

  const cached = daysUntilDueCache.get(dueDateStr);
  if (cached !== undefined) {
    return cached;
  }

  const datePart = dueDateStr.includes('T') ? dueDateStr.split('T')[0] : dueDateStr;
  if (!datePart) {
    daysUntilDueCache.set(dueDateStr, null);
    return null;
  }

  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) {
    daysUntilDueCache.set(dueDateStr, null);
    return null;
  }

  const dueResetMs = new Date(y, m - 1, d).getTime();
  const diffMs = dueResetMs - cachedTodayResetMs;
  const result = Math.round(diffMs / 86400000);
  daysUntilDueCache.set(dueDateStr, result);
  return result;
};

// Pre-computes client IDs that have unpaid overdue charges in a single O(M) pass
export const getOverdueChargeClientIds = (charges: Charge[] = []): Set<string> => {
  const overdueSet = new Set<string>();
  for (let i = 0; i < charges.length; i++) {
    const ch = charges[i];
    if (!ch.paid && ch.dueDate) {
      const diff = getDaysUntilDue(ch.dueDate);
      if (diff !== null && diff < 0) {
        overdueSet.add(ch.clientId);
      }
    }
  }
  return overdueSet;
};

export const isClientActive = (
  client: Client,
  charges: Charge[] = [],
  precomputedOverdueClientIds?: Set<string>
): boolean => {
  if (!client) return false;
  const diff = getDaysUntilDue(client.dueDate);
  if (diff !== null && diff < 0) return false;

  if (precomputedOverdueClientIds) {
    return !precomputedOverdueClientIds.has(client.id);
  }

  for (let i = 0; i < charges.length; i++) {
    const c = charges[i];
    if (c.clientId === client.id && !c.paid) {
      const cDiff = getDaysUntilDue(c.dueDate);
      if (cDiff !== null && cDiff < 0) return false;
    }
  }
  return true;
};

export const getClientStatusBadge = (dueDateStr?: string) => {
  if (!dueDateStr || typeof dueDateStr !== 'string') {
    return {
      label: 'Sem Vencimento',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
    };
  }

  getTodayResetMs();
  const cachedBadge = statusBadgeCache.get(dueDateStr);
  if (cachedBadge) {
    return cachedBadge;
  }

  const diffDays = getDaysUntilDue(dueDateStr);
  if (diffDays === null) {
    const res = {
      label: 'Sem Vencimento',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
    };
    statusBadgeCache.set(dueDateStr, res);
    return res;
  }

  let res: { label: string; className: string };
  if (diffDays === 0) {
    res = {
      label: 'Vence Hoje',
      className: 'bg-amber-100 text-amber-800 border border-amber-300 font-bold',
    };
  } else if (diffDays > 0) {
    const label = diffDays === 1 ? 'Vence em 1 dia' : `Vence em ${diffDays} dias`;
    res = {
      label,
      className: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold',
    };
  } else {
    const overdueDays = Math.abs(diffDays);
    const label = overdueDays === 1 ? 'Atrasado (1 dia)' : `Atrasado (${overdueDays} dias)`;
    res = {
      label,
      className: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
    };
  }

  statusBadgeCache.set(dueDateStr, res);
  return res;
};



