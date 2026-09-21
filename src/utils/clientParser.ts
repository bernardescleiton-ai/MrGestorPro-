import { Client } from '../types';

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
}

export interface ParsedBulkClient {
  name: string;
  phone: string;
  dueDate: string;
  notes: string;
  action?: 'create' | 'update';
  comparison?: BulkClientComparison;
}

export function isExplicitDateString(str: string): boolean {
  if (!str || !str.trim()) return false;
  const s = str.trim();

  // Pure date formats: 06/08/2026, 06-08-2026, 06.08.2026, 2026-08-06, 2026/08/06, 06/08, 06-08, 06.08, 06/08/26
  if (/^([0-3]?\d[./-][0-1]?\d([./-]\d{2,4})?|\d{4}[./-][0-1]?\d[./-][0-3]?\d)$/.test(s)) {
    return true;
  }

  // Date with time or timestamp: "06/08/2026 14:30", "06/08/2026 às 14:30", "2026-08-06T14:30", "13/08 13h26", "20/08/2026 19h48"
  if (/^([0-3]?\d[./-][0-1]?\d([./-]\d{2,4})?|\d{4}[./-][0-1]?\d[./-][0-3]?\d)\s*([T\s-]|às\s+|as\s+)?(([01]?\d|2[0-3])[:hH]([0-5]\d)?)/i.test(s)) {
    return true;
  }

  // Text month date: "15 de outubro de 2026", "15 de out", "15 out 2026"
  if (/^([0-3]?\d)\s*(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\s*(?:de\s+)?\d{2,4})?/i.test(s)) {
    return true;
  }

  // Date with labels: "Vencimento: 06/08/2026", "Vence dia 06/08", "Validade: 2026-08-06", "Renovado até 06/08"
  if (/^(vencimento|venc|vence|data|data de vencimento|validade|renovacao|renovado|prazo|ate)\b/i.test(s)) {
    return true;
  }

  // Relative offset like "2 anos", "24 meses", "1 ano", "30 dias"
  if (/^(\d+\s*(anos?|meses?|dias?))$/i.test(s)) {
    return true;
  }

  return false;
}

export function extractPhoneNumber(text: string): string {
  if (!text) return '';
  const clean = text.replace(/^(whatsapp|whats|wpp|telefone|tel|celular|cel|fone|phone|mobile)\s*[:=-]\s*/i, '').trim();

  // 1) Match international format starting with + (e.g. +1 (555) 123-4567, +351 912 345 678, +44 7911 123456, +55 11 99999-9999)
  const matchInternationalPlus = clean.match(/\+(?:[1-9]\d{0,2})[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);
  if (matchInternationalPlus) {
    return matchInternationalPlus[0].trim();
  }

  // 2) Match Portugal numbers with DDI 351 (e.g. 351 912 345 678, 351912345678, 351 21 123 4567)
  const matchPortugal = clean.match(/\b351[-.\s]?(?:9\d{2}|\d{2})[-.\s]?\d{3}[-.\s]?\d{3,4}\b/);
  if (matchPortugal) {
    return matchPortugal[0].trim();
  }

  // 3) Match USA / Canada numbers with DDI 1 or US format (e.g. 1 (555) 123-4567, (555) 123-4567, 1-555-123-4567)
  const matchUSA = clean.match(/\b1[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}\b/);
  if (matchUSA) {
    return matchUSA[0].trim();
  }

  // 4) Match standard Brazil with DDD + number (e.g. 48 9608-9646, (48) 99189-3201, +55 48 9608-9646, 51 9482-1163)
  const matchWithDDD = clean.match(/(?:\+?55\s*)?(?:\([1-9]{2}\)|[1-9]{2})\s*(?:9\d{4}|\d{4})[-.\s]?\d{4}/);
  if (matchWithDDD) {
    return matchWithDDD[0].trim();
  }

  // 5) Match 10 or 11 digits continuous or formatted
  const matchDigits = clean.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\d{4}|\d{4})[-.\s]?\d{4}/);
  if (matchDigits) {
    return matchDigits[0].trim();
  }

  // 6) Match 8 or 9 digits local number (e.g. 9608-9646, 99608-9646)
  const matchLocal = clean.match(/\b(?:9\d{4}|\d{4})[-.\s]?\d{4}\b/);
  if (matchLocal) {
    return matchLocal[0].trim();
  }

  return '';
}

export function isPhoneNumber(str: string): boolean {
  if (!str || !str.trim()) return false;
  const s = str.trim();

  // If it's an explicit date string, it's NOT a phone number
  if (isExplicitDateString(s)) return false;

  const clean = s.replace(/^(whatsapp|whats|wpp|telefone|tel|celular|cel|fone|phone|mobile)\s*[:=-]\s*/i, '').trim();

  const digits = clean.replace(/\D/g, '');
  const letters = clean.replace(/[^a-zA-ZÀ-ÿ]/g, '');

  // If there are letters (and not just label), it's a name or notes, not a pure phone line
  if (letters.length > 0) {
    return false;
  }

  // Check digit length for valid phone numbers (national & international: 7 to 15 digits according to E.164)
  if (digits.length >= 7 && digits.length <= 15) {
    return true;
  }

  return false;
}

export function isDateString(str: string): boolean {
  if (!str || !str.trim()) return false;
  return isExplicitDateString(str.trim());
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

export function cleanClientName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName.trim();

  // Only remove leading field labels like "Nome:", "Cliente:", "Empresa:" if explicitly present
  cleaned = cleaned.replace(/^(nome|cliente|empresa|nome\/empresa|raz[aã]o social)\s*[:=-]\s*/i, '');

  return cleaned.trim();
}

export function formatForDateTimeInput(val?: string | null): string {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim();
  if (!s) return '';
  // Exact format expected by HTML5 <input type="datetime-local">
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  // ISO string with seconds or timezone: 2026-10-15T14:30:00.000Z -> 2026-10-15T14:30
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  // Date only: 2026-10-15 -> 2026-10-15T00:00
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
  // Brazilian or text date: 15/10/2026, 15-10-2026, etc.
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

  // 1. Relative offset in text (e.g. "2 anos", "1 ano", "6 meses", "3 meses", "1 mes", "30 dias")
  if (/(\b2\s*anos?\b|\b24\s*meses?\b)/i.test(text)) {
    return addOffsetToCurrentDate(24, timeStr);
  }
  if (/(\b1\s*ano\b|\b12\s*meses?\b)/i.test(text)) {
    return addOffsetToCurrentDate(12, timeStr);
  }
  if (/(\b6\s*meses?\b)/i.test(text)) {
    return addOffsetToCurrentDate(6, timeStr);
  }
  if (/(\b3\s*meses?\b)/i.test(text)) {
    return addOffsetToCurrentDate(3, timeStr);
  }
  if (/(\b1\s*m[êe]s\b)/i.test(text)) {
    return addOffsetToCurrentDate(1, timeStr);
  }
  if (/(\b30\s*dias?\b)/i.test(text)) {
    return addOffsetToCurrentDate(1, timeStr);
  }

  // 2. Text month date in Portuguese (e.g. "15 de outubro de 2026", "15 out 2026", "15 de out", "15/out/2026")
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

  // 3. Brazilian date with year (06/08/2026, 06-08-2026, 06.08.2026, 06/08/26, 6/8/2026)
  const brDateMatch = text.match(/\b([0-3]?\d)[./-]([0-1]?\d)[./-](\d{2,4})\b/);
  if (brDateMatch) {
    const day = brDateMatch[1].padStart(2, '0');
    const month = brDateMatch[2].padStart(2, '0');
    let year = brDateMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}T${timeStr}`;
  }

  // 4. ISO date (2026-08-06 or 2026/08/06)
  const isoDateMatch = text.match(/\b(\d{4})[./-]([0-1]?\d)[./-]([0-3]?\d)\b/);
  if (isoDateMatch) {
    const year = isoDateMatch[1];
    const month = isoDateMatch[2].padStart(2, '0');
    const day = isoDateMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}T${timeStr}`;
  }

  // 5. Day / Month without year (06/08, 06-08, 06.08, 6/8)
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

  // 6. Day only (e.g. "dia 15", "todo dia 10", "vence dia 05", "dia 20")
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

  // 1. Phone number
  phone = extractPhoneNumber(rawText);

  // 2. Relative offset or explicit date
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

  // 3. Process lines and segments
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

export function normalizeNameForComparison(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(nome|cliente|empresa|nome\/empresa|raz[aã]o social)\s*[:=-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isDuplicateClientName(
  candidateName: string,
  existingClients: Client[],
  excludeId?: string,
  candidatePhone?: string
): Client | undefined {
  if (!candidateName && !candidatePhone) return undefined;

  const cleanCandidateName = normalizeNameForComparison(candidateName || '');
  const candidatePhoneDigits = candidatePhone ? candidatePhone.replace(/\D/g, '') : '';

  return existingClients.find((c) => {
    if (excludeId && c.id === excludeId) return false;

    // 1. Match by normalized name
    if (cleanCandidateName) {
      const cleanExistingName = normalizeNameForComparison(c.name || '');
      if (cleanCandidateName === cleanExistingName) {
        return true;
      }
    }

    // 2. Match by phone number (if both have >= 8 digits)
    if (candidatePhoneDigits && candidatePhoneDigits.length >= 8 && c.phone) {
      const existingPhoneDigits = c.phone.replace(/\D/g, '');
      if (existingPhoneDigits.length >= 8) {
        if (candidatePhoneDigits === existingPhoneDigits) return true;
        // Compare with or without 55 DDI
        const candNoDDI = candidatePhoneDigits.replace(/^55/, '');
        const existNoDDI = existingPhoneDigits.replace(/^55/, '');
        if (candNoDDI === existNoDDI && candNoDDI.length >= 8) return true;
      }
    }

    return false;
  });
}

