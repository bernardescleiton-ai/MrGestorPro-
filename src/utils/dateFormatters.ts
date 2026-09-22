import { Client, Charge } from '../types';

export const parseAnyDateToParts = (dueDateStr?: string): { year: number; month: number; day: number; hour?: number; minute?: number } | null => {
  if (!dueDateStr || typeof dueDateStr !== 'string') return null;
  const trimmed = dueDateStr.trim();
  if (!trimmed) return null;

  let datePart = trimmed;
  let timePart = '';
  if (trimmed.includes('T')) {
    const parts = trimmed.split('T');
    datePart = parts[0];
    timePart = parts[1] || '';
  } else if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/);
    if (parts[1] && /^([01]?\d|2[0-3])[:hH]([0-5]\d)?/.test(parts[1])) {
      datePart = parts[0];
      timePart = parts[1];
    }
  }

  let y = 0, m = 0, d = 0;

  // Match YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (where first part is 4 digits)
  const isoMatch = datePart.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (isoMatch) {
    y = parseInt(isoMatch[1], 10);
    m = parseInt(isoMatch[2], 10);
    d = parseInt(isoMatch[3], 10);
  } else {
    // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (where last part is 2 or 4 digits)
    const brMatch = datePart.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
    if (brMatch) {
      d = parseInt(brMatch[1], 10);
      m = parseInt(brMatch[2], 10);
      let yearStr = brMatch[3];
      if (yearStr.length === 2) yearStr = `20${yearStr}`;
      y = parseInt(yearStr, 10);
    } else {
      // Match DD/MM (no year)
      const dayMonthMatch = datePart.match(/^(\d{1,2})[./-](\d{1,2})$/);
      if (dayMonthMatch) {
        d = parseInt(dayMonthMatch[1], 10);
        m = parseInt(dayMonthMatch[2], 10);
        const now = new Date();
        y = now.getFullYear();
        const targetThisYear = new Date(y, m - 1, d);
        if (now.getTime() - targetThisYear.getTime() > 180 * 86400000) {
          y += 1;
        }
      }
    }
  }

  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  let hour = 0;
  let minute = 0;
  if (timePart) {
    const tMatch = timePart.match(/^([01]?\d|2[0-3])[:hH]([0-5]\d)?/);
    if (tMatch) {
      hour = parseInt(tMatch[1], 10);
      minute = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
    }
  }

  return { year: y, month: m, day: d, hour, minute };
};

export const dateBR = (s: string): string => {
  if (!s || typeof s !== 'string') return '';
  const parsed = parseAnyDateToParts(s);
  if (!parsed) return s;
  const dayStr = String(parsed.day).padStart(2, '0');
  const monthStr = String(parsed.month).padStart(2, '0');
  const yearStr = String(parsed.year);
  return `${dayStr}/${monthStr}/${yearStr}`;
};

export const todayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const daysBetween = (a: string, b: string): number => {
  const parsedA = parseAnyDateToParts(a);
  const parsedB = parseAnyDateToParts(b);
  if (!parsedA || !parsedB) return 0;
  const da = new Date(parsedA.year, parsedA.month - 1, parsedA.day);
  const db = new Date(parsedB.year, parsedB.month - 1, parsedB.day);
  return Math.round((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24));
};

export const formatDateTimeBR = (isoStr?: string): string => {
  if (!isoStr) return '—';
  const parsed = parseAnyDateToParts(isoStr);
  if (!parsed) return isoStr;
  const dayStr = String(parsed.day).padStart(2, '0');
  const monthStr = String(parsed.month).padStart(2, '0');
  const yearStr = String(parsed.year);
  const formattedDate = `${dayStr}/${monthStr}/${yearStr}`;
  if (parsed.hour !== undefined && (parsed.hour > 0 || parsed.minute > 0 || isoStr.includes('T') || isoStr.includes(':'))) {
    const hh = String(parsed.hour).padStart(2, '0');
    const mm = String(parsed.minute).padStart(2, '0');
    if (hh !== '00' || mm !== '00') {
      return `${formattedDate} às ${hh}:${mm}`;
    }
  }
  return formattedDate;
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

  const parsed = parseAnyDateToParts(dueDateStr);
  if (!parsed) {
    daysUntilDueCache.set(dueDateStr, null);
    return null;
  }

  const dueResetMs = new Date(parsed.year, parsed.month - 1, parsed.day).getTime();
  const diffMs = dueResetMs - cachedTodayResetMs;
  const result = Math.round(diffMs / 86400000);
  daysUntilDueCache.set(dueDateStr, result);
  return result;
};

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

export const getChargeStatus = (c: Charge) => {
  if (c.paid) {
    return {
      label: 'Pago',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    };
  }
  const diff = getDaysUntilDue(c.dueDate);
  if (diff === null) {
    return {
      label: 'Pendente',
      className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };
  }
  if (diff === 0) {
    return {
      label: 'Vence Hoje',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    };
  }
  if (diff > 0) {
    return {
      label: diff === 1 ? 'Vence em 1 dia' : `Vence em ${diff}d`,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    };
  }
  return {
    label: `Atrasado (${Math.abs(diff)}d)`,
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  };
};

export const formatDateForDisplay = (isoStr?: string): string => {
  if (!isoStr) return '';
  return dateBR(isoStr);
};

export const formatForDateTimeInput = (isoStr?: string): string => {
  if (!isoStr) return '';
  const parsed = parseAnyDateToParts(isoStr);
  if (!parsed) return isoStr;
  const y = String(parsed.year);
  const m = String(parsed.month).padStart(2, '0');
  const d = String(parsed.day).padStart(2, '0');
  const hh = String(parsed.hour || 0).padStart(2, '0');
  const mm = String(parsed.minute || 0).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

export const formatDateForInput = (isoStr?: string): string => {
  if (!isoStr) return '';
  const parsed = parseAnyDateToParts(isoStr);
  if (!parsed) return isoStr;
  const y = String(parsed.year);
  const m = String(parsed.month).padStart(2, '0');
  const d = String(parsed.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatTimeForInput = (isoStr?: string): string => {
  if (!isoStr) return '';
  const parsed = parseAnyDateToParts(isoStr);
  if (!parsed || parsed.hour === undefined) return '';
  const hh = String(parsed.hour).padStart(2, '0');
  const mm = String(parsed.minute || 0).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const calculateRenewalDueDate = (currentDueDateStr?: string, monthsToAdd: number = 1): string => {
  const months = Math.max(1, monthsToAdd);
  const now = new Date();
  let baseYear = now.getFullYear();
  let baseMonth = now.getMonth();
  let baseDay = now.getDate();
  let timeStr = '12:00';

  if (currentDueDateStr) {
    const parsed = parseAnyDateToParts(currentDueDateStr);
    if (parsed) {
      const parsedDate = new Date(parsed.year, parsed.month - 1, parsed.day);
      if (parsedDate.getTime() > now.getTime()) {
        baseYear = parsed.year;
        baseMonth = parsed.month - 1;
        baseDay = parsed.day;
      }
      if (parsed.hour !== undefined && (parsed.hour > 0 || parsed.minute > 0)) {
        timeStr = `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute || 0).padStart(2, '0')}`;
      }
    }
  }

  const targetDate = new Date(baseYear, baseMonth + months, baseDay);
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${timeStr}`;
};

