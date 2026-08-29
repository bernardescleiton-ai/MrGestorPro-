import { Client } from '../types';

export interface ParsedBulkClient {
  name: string;
  phone: string;
  dueDate: string;
  notes: string;
}

export function isExplicitDateString(str: string): boolean {
  if (!str || !str.trim()) return false;
  const s = str.trim();

  // Pure date formats: 06/08/2026, 06-08-2026, 2026-08-06, 06/08, 06-08, 06/08/26
  if (/^([0-3]?\d[\/\.-][0-1]?\d([\/\.-]\d{2,4})?|\d{4}[\/\.-][0-1]?\d[\/\.-][0-3]?\d)$/.test(s)) {
    return true;
  }

  // Date with time or timestamp: "06/08/2026 14:30", "2026-08-06T14:30", "13/08 13h26", "20/08/2026 19h48"
  if (/^([0-3]?\d[\/\.-][0-1]?\d([\/\.-]\d{2,4})?|\d{4}[\/\.-][0-1]?\d[\/\.-][0-3]?\d)\s*([T\s]?([01]?\d|2[0-3])[:hH]([0-5]\d))?$/i.test(s)) {
    return true;
  }

  // Date with labels: "Vencimento: 06/08/2026", "Vence dia 06/08", "Data: 2026-08-06", "Vencimento"
  if (/^(vencimento|vence|data|data de vencimento|venc)\b/i.test(s)) {
    return true;
  }

  // Relative offset like "2 anos", "24 meses", "1 ano"
  if (/^(\d+\s*(anos?|meses?|dias?))$/i.test(s)) {
    return true;
  }

  return false;
}

export function extractPhoneNumber(text: string): string {
  if (!text) return '';
  const clean = text.replace(/^(whatsapp|whats|wpp|telefone|tel|celular|cel|fone|phone|mobile)\s*[:=-]\s*/i, '').trim();

  // 1) Match with DDD + number (e.g. 48 9608-9646, (48) 99189-3201, +55 48 9608-9646, 51 9482-1163)
  const matchWithDDD = clean.match(/(?:\+?55\s*)?(?:\([1-9]{2}\)|[1-9]{2})\s*(?:9\d{4}|\d{4})[-.\s]?\d{4}/);
  if (matchWithDDD) {
    return matchWithDDD[0].trim();
  }

  // 2) Match 10 or 11 digits continuous or formatted
  const matchDigits = clean.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\d{4}|\d{4})[-.\s]?\d{4}/);
  if (matchDigits) {
    return matchDigits[0].trim();
  }

  // 3) Match 8 or 9 digits local number (e.g. 9608-9646, 99608-9646)
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

  // Check digit length for valid Brazilian phone numbers (8 to 13 digits)
  if (digits.length >= 8 && digits.length <= 13) {
    return true;
  }

  return false;
}

export function isDateString(str: string): boolean {
  if (!str || !str.trim()) return true;
  const s = str.trim();

  if (isExplicitDateString(s)) {
    return true;
  }

  if (isPhoneNumber(s)) {
    return false;
  }

  // If there are fewer than 2 letters (e.g. "123456", "06/08", "14:30")
  const letters = s.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letters.length < 2) {
    return true;
  }

  return false;
}

export function cleanClientName(rawName: string): string {
  if (!rawName) return '';
  let cleaned = rawName.trim();

  // 1. Remove full or partial date strings
  cleaned = cleaned.replace(/\b[0-3]?\d[\/\.-][0-1]?\d[\/\.-]\d{2,4}\b/g, '');
  cleaned = cleaned.replace(/\b\d{4}[\/\.-][0-1]?\d[\/\.-][0-3]?\d\b/g, '');
  cleaned = cleaned.replace(/\b[0-3]?\d[\/\.-][0-1]?\d\b/g, '');
  cleaned = cleaned.replace(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/g, '');

  // 2. Remove phone numbers if attached at end of name line
  const phone = extractPhoneNumber(cleaned);
  if (phone) {
    cleaned = cleaned.replace(phone, '');
  }

  // 3. Remove field labels
  cleaned = cleaned.replace(/^(nome|cliente|empresa|nome\/empresa|razao social)\s*[:=-]\s*/i, '');
  cleaned = cleaned.replace(/^(vencimento|vence|data|data de vencimento|venc)\s*[:=-]\s*/i, '');
  cleaned = cleaned.replace(/^(whatsapp|whats|wpp|telefone|tel|celular|cel|fone|phone|mobile)\s*[:=-]\s*/i, '');

  // 4. Strip leading/trailing separators and spaces (preserve leading numbers & letters)
  cleaned = cleaned.replace(/^[\s\-\|,:]+|[\s\-\|,:]+$/g, '').trim();

  return cleaned;
}

export function parseDateAndTimeString(text: string): string {
  if (!text) return '';
  let timeStr = '00:00';
  const timeMatch = text.match(/\b([01]?\d|2[0-3])[:hH]([0-5]\d)\b/);
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0');
    const mm = timeMatch[2].padStart(2, '0');
    timeStr = `${hh}:${mm}`;
  }

  // 1. Brazilian date with year (06/08/2026 or 06/08/26)
  const brDateMatch = text.match(/\b([0-3]?\d)[\/\.-]([0-1]?\d)[\/\.-](\d{2,4})\b/);
  if (brDateMatch) {
    const day = brDateMatch[1].padStart(2, '0');
    const month = brDateMatch[2].padStart(2, '0');
    let year = brDateMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}T${timeStr}`;
  }

  // 2. ISO date (2026-08-06)
  const isoDateMatch = text.match(/\b(\d{4})[\/\.-]([0-1]?\d)[\/\.-]([0-3]?\d)\b/);
  if (isoDateMatch) {
    const year = isoDateMatch[1];
    const month = isoDateMatch[2].padStart(2, '0');
    const day = isoDateMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}T${timeStr}`;
  }

  // 3. Day / Month without year (06/08 or 06-08)
  const dayMonthMatch = text.match(/\b([0-3]?\d)[\/\.-]([0-1]?\d)\b/);
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

  return '';
}

export function addOffsetToCurrentDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

    if (/^(vencimento|vence|data|data de vencimento|venc)\s*[:=-]\s*/i.test(line)) {
      const extractedDateStr = line.replace(/^(vencimento|vence|data|data de vencimento|venc)\s*[:=-]\s*/i, '').trim();
      const dt = parseDateAndTimeString(extractedDateStr);
      if (dt) dueDate = dt;
      continue;
    }

    if (/^(obs|observação|observacoes|notas|nota|info|detalhes)\s*[:=-]\s*/i.test(line)) {
      notes = line.replace(/^(obs|observação|observacoes|notas|nota|info|detalhes)\s*[:=-]\s*/i, '').trim();
      continue;
    }

    const segments = line.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
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

export function parseBulkClients(rawText: string): ParsedBulkClient[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const clientEntries: ParsedBulkClient[] = [];

  let i = 0;
  while (i < lines.length) {
    const l1 = lines[i];
    const l2 = lines[i + 1] || '';
    const l3 = lines[i + 2] || '';

    const l1Date = isDateString(l1);
    const l2Date = isDateString(l2);
    const l3Date = isDateString(l3);

    const l1Phone = isPhoneNumber(l1);
    const l2Phone = isPhoneNumber(l2);
    const l3Phone = isPhoneNumber(l3);

    const l1Name = !l1Date && !l1Phone;
    const l2Name = l2 ? !l2Date && !l2Phone : false;
    const l3Name = l3 ? !l3Date && !l3Phone : false;

    // --- CASE 1: 3-line block with 1 Name, 1 Date, 1 Phone (in ANY order among l1, l2, l3) ---
    const window3 = [
      { text: l1, isDate: l1Date, isPhone: l1Phone, isName: l1Name },
      { text: l2, isDate: l2Date, isPhone: l2Phone, isName: l2Name },
      { text: l3, isDate: l3Date, isPhone: l3Phone, isName: l3Name },
    ];

    const datesIn3 = window3.filter((x) => x.isDate);
    const phonesIn3 = window3.filter((x) => x.isPhone);
    const namesIn3 = window3.filter((x) => x.isName);

    if (namesIn3.length === 1 && datesIn3.length === 1 && phonesIn3.length === 1) {
      const rawNameStr = namesIn3[0].text;
      const finalName = cleanClientName(rawNameStr);
      const dueDate = parseDateAndTimeString(datesIn3[0].text);
      const phone = extractPhoneNumber(phonesIn3[0].text);

      if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
        clientEntries.push({
          name: finalName,
          phone: phone,
          dueDate: dueDate,
          notes: '',
        });
      }
      i += 3;
      continue;
    }

    // --- CASE 2: 2-line block with (Name and Date) OR (Name and Phone) ---
    if (l2) {
      // 2a: l1 is Name, l2 is Date
      if (l1Name && l2Date) {
        const finalName = cleanClientName(l1);
        const dueDate = parseDateAndTimeString(l2);
        const phone = extractPhoneNumber(l1);

        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: phone,
            dueDate: dueDate,
            notes: '',
          });
        }
        i += 2;
        continue;
      }

      // 2b: l1 is Date, l2 is Name
      if (l1Date && l2Name) {
        const finalName = cleanClientName(l2);
        const dueDate = parseDateAndTimeString(l1);
        const phone = extractPhoneNumber(l2);

        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: phone,
            dueDate: dueDate,
            notes: '',
          });
        }
        i += 2;
        continue;
      }

      // 2c: l1 is Name, l2 is Phone
      if (l1Name && l2Phone) {
        const finalName = cleanClientName(l1);
        const phone = extractPhoneNumber(l2);

        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: phone,
            dueDate: '',
            notes: '',
          });
        }
        i += 2;
        continue;
      }

      // 2d: l1 is Phone, l2 is Name
      if (l1Phone && l2Name) {
        const finalName = cleanClientName(l2);
        const phone = extractPhoneNumber(l1);

        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: phone,
            dueDate: '',
            notes: '',
          });
        }
        i += 2;
        continue;
      }
    }

    // --- CASE 3: Single line containing Name, or Name + Date + Phone combined ---
    if (!l1Date && !l1Phone) {
      const parsed = parseClientText(l1);
      const finalName = cleanClientName(parsed.name || l1);

      if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
        clientEntries.push({
          name: finalName,
          phone: parsed.phone || '',
          dueDate: parsed.dueDate || '',
          notes: parsed.notes || '',
        });
      }
    }

    i += 1;
  }

  return clientEntries;
}

export function isDuplicateClientName(
  candidateName: string,
  existingClients: Client[],
  excludeId?: string
): Client | undefined {
  if (!candidateName || !candidateName.trim()) return undefined;
  const cleanCandidate = cleanClientName(candidateName).toLowerCase();
  if (!cleanCandidate) return undefined;

  return existingClients.find((c) => {
    if (excludeId && c.id === excludeId) return false;
    const cleanExisting = cleanClientName(c.name || '').toLowerCase();

    if (cleanCandidate === cleanExisting) {
      return true;
    }
    return false;
  });
}

