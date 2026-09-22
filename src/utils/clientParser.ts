import {
  isExplicitDateString,
  extractPhoneNumber,
  isPhoneNumber,
  isDateString,
  cleanClientName,
  normalizeNameForComparison,
  isDuplicateClientName,
} from './clientPhoneUtils';

export {
  isExplicitDateString,
  extractPhoneNumber,
  isPhoneNumber,
  isDateString,
  cleanClientName,
  normalizeNameForComparison,
  isDuplicateClientName,
};

export interface BulkClientComparison {
  isExisting: boolean;
  existingClientId?: string;
  existingClientName?: string;
  phoneChanged: boolean;
  oldPhone?: string;
  newPhone?: string;
  dueDateChanged: boolean;
  oldDueDate?: string;
  newDueDate?: string;
  notesChanged?: boolean;
  isBatchDuplicate?: boolean;
  batchDuplicateIndex?: number;
  duplicateType?: 'none' | 'system_duplicate' | 'batch_duplicate';
}

export interface ParsedBulkClient {
  id?: string;
  name: string;
  phone: string;
  dueDate: string;
  notes: string;
  action?: 'create' | 'update' | 'ignore';
  selected?: boolean;
  comparison?: BulkClientComparison;
}

const PT_MONTHS_MAP: Record<string, string> = {
  jan: '01', janeiro: '01',
  fev: '02', fevereiro: '02',
  mar: '03', marco: '03', 'março': '03',
  abr: '04', abril: '04',
  mai: '05', maio: '05',
  jun: '06', junho: '06',
  jul: '07', julho: '07',
  ago: '08', agosto: '08',
  set: '09', setembro: '09',
  out: '10', outubro: '10',
  nov: '11', novembro: '11',
  dez: '12', dezembro: '12',
};

export function formatForDateTimeInput(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  const parsed = parseDateAndTimeString(s);
  if (parsed) return parsed;
  return '';
}

export function parseDateAndTimeString(text: string): string {
  if (!text) return '';
  let timeStr = '00:00';
  const timeMatch = text.match(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)?\b/);
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0');
    const mm = (timeMatch[2] || '00').padStart(2, '0');
    timeStr = `${hh}:${mm}`;
  }

  // 1. Relative offset in text
  if (/(\b2\s*anos?\b|\b24\s*meses?\b)/i.test(text)) return addOffsetToCurrentDate(24, timeStr);
  if (/(\b1\s*ano\b|\b12\s*meses?\b)/i.test(text)) return addOffsetToCurrentDate(12, timeStr);
  if (/(\b6\s*meses?\b)/i.test(text)) return addOffsetToCurrentDate(6, timeStr);
  if (/(\b3\s*meses?\b)/i.test(text)) return addOffsetToCurrentDate(3, timeStr);
  if (/(\b1\s*m[êe]s\b|\b30\s*dias?\b)/i.test(text)) return addOffsetToCurrentDate(1, timeStr);

  // 2. Text month date in Portuguese
  const textMonthMatch = text.match(/\b([0-3]?\d)\s*(?:de\s+|\/|\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\s*(?:de\s+|\/|\s+)?(\d{2,4}))?\b/i);
  if (textMonthMatch) {
    const day = textMonthMatch[1].padStart(2, '0');
    const monthKey = textMonthMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = PT_MONTHS_MAP[monthKey] || '01';
    let year = textMonthMatch[3];
    if (year) {
      if (year.length === 2) year = `20${year}`;
    } else {
      const now = new Date();
      year = String(now.getFullYear());
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      const targetDateThisYear = new Date(parseInt(year, 10), monthNum - 1, dayNum);
      if (now.getTime() - targetDateThisYear.getTime() > 180 * 24 * 60 * 60 * 1000) {
        year = String(parseInt(year, 10) + 1);
      }
    }
    return `${year}-${month}-${day}T${timeStr}`;
  }

  // 3. Brazilian date with year
  const brDateMatch = text.match(/\b([0-3]?\d)[./-]([0-1]?\d)[./-](\d{2,4})\b/);
  if (brDateMatch) {
    const day = brDateMatch[1].padStart(2, '0');
    const month = brDateMatch[2].padStart(2, '0');
    let year = brDateMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}T${timeStr}`;
  }

  // 4. ISO date
  const isoDateMatch = text.match(/\b(\d{4})[./-]([0-1]?\d)[./-]([0-3]?\d)\b/);
  if (isoDateMatch) {
    const year = isoDateMatch[1];
    const month = isoDateMatch[2].padStart(2, '0');
    const day = isoDateMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}T${timeStr}`;
  }

  // 5. Day / Month without year
  const dayMonthMatch = text.match(/\b([0-3]?\d)[./-]([0-1]?\d)\b/);
  if (dayMonthMatch) {
    const dayNum = parseInt(dayMonthMatch[1], 10);
    const monthNum = parseInt(dayMonthMatch[2], 10);
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
      const day = String(dayNum).padStart(2, '0');
      const month = String(monthNum).padStart(2, '0');
      const now = new Date();
      let year = now.getFullYear();
      const targetDateThisYear = new Date(year, monthNum - 1, dayNum);
      if (now.getTime() - targetDateThisYear.getTime() > 180 * 24 * 60 * 60 * 1000) {
        year += 1;
      }
      return `${year}-${month}-${day}T${timeStr}`;
    }
  }

  // 6. Day only
  const dayOnlyMatch = text.match(/(?:todo\s+)?dia\s+([0-3]?\d)\b/i);
  if (dayOnlyMatch) {
    const dayNum = parseInt(dayOnlyMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      const day = String(dayNum).padStart(2, '0');
      const now = new Date();
      let month = now.getMonth() + 1;
      let year = now.getFullYear();
      if (now.getDate() > dayNum) {
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
      return `${year}-${String(month).padStart(2, '0')}-${day}T${timeStr}`;
    }
  }

  return '';
}

export function addOffsetToCurrentDate(months: number, customTime?: string): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const time = customTime || '00:00';
  return `${year}-${month}-${day}T${time}`;
}

export function parseClientText(rawText: string) {
  let name = '';
  let phone = '';
  let dueDate = '';
  let notes = '';

  if (!rawText || !rawText.trim()) {
    return { name, phone, dueDate, notes };
  }

  phone = extractPhoneNumber(rawText);

  if (/(\b2\s*anos?\b|\b24\s*meses?\b)/i.test(rawText)) {
    dueDate = addOffsetToCurrentDate(24);
  } else if (/(\b1\s*ano\b|\b12\s*meses?\b)/i.test(rawText)) {
    dueDate = addOffsetToCurrentDate(12);
  } else if (/(\b6\s*meses?\b)/i.test(rawText)) {
    dueDate = addOffsetToCurrentDate(6);
  } else {
    const parsedDt = parseDateAndTimeString(rawText);
    if (parsedDt) {
      dueDate = parsedDt;
    }
  }

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const remainingParts: string[] = [];

  for (const line of lines) {
    if (/^(nome|cliente|empresa|nome\/empresa|razao social)\s*[:=-]\s*/i.test(line)) {
      name = cleanClientName(line.replace(/^(nome|cliente|empresa|nome\/empresa|razao social)\s*[:=-]\s*/i, ''));
      continue;
    }

    if (/^(whatsapp|whats|wpp|telefone|tel|celular|cel|fone|phone|mobile)\s*[:=-]\s*/i.test(line)) {
      const extractedPhone = extractPhoneNumber(line);
      if (extractedPhone) phone = extractedPhone;
      continue;
    }

    if (/^(vencimento|venc|vence|data|data de vencimento|validade|renovacao|renovado|prazo)\s*[:=-]\s*/i.test(line)) {
      const extractedDateStr = line.replace(/^(vencimento|venc|vence|data|data de vencimento|validade|renovacao|renovado|prazo)\s*[:=-]\s*/i, '').trim();
      const dt = parseDateAndTimeString(extractedDateStr);
      if (dt) dueDate = dt;
      continue;
    }

    if (/^(obs|observação|observacao|observacoes|notas|nota|info|detalhes|plano)\s*[:=-]\s*/i.test(line)) {
      notes = line.replace(/^(obs|observação|observacao|observacoes|notas|nota|info|detalhes|plano)\s*[:=-]\s*/i, '').trim();
      continue;
    }

    const segments = line.split(/[,;\t|]/).map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
      if (!isDateString(seg) && !isPhoneNumber(seg)) {
        remainingParts.push(seg);
      }
    }
  }

  const cleanSegments = remainingParts
    .map((part) => cleanClientName(part))
    .filter((part) => part && !isDateString(part) && !isPhoneNumber(part));

  if (!name && cleanSegments.length > 0) {
    name = cleanSegments[0];
  }

  if (!notes && cleanSegments.length > 1) {
    notes = cleanSegments.slice(1).join(' - ');
  }

  if (isDateString(name) || isPhoneNumber(name)) {
    name = '';
  }

  return { name, phone, dueDate, notes };
}

export { parseBulkClients } from './bulkClientParser';
