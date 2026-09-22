import { Client } from '../types';

export function isExplicitDateString(str: string): boolean {
  if (!str || !str.trim()) return false;
  const s = str.trim();

  // Pure date formats: 06/08/2026, 06-08-2026, 06.08.2026, 2026-08-06, 2026/08/06, 06/08, 06-08, 06.08, 06/08/26
  if (/^([0-3]?\d[./-][0-1]?\d([./-]\d{2,4})?|\d{4}[./-][0-1]?\d[./-][0-3]?\d)$/.test(s)) {
    return true;
  }

  // Date with time or timestamp
  if (/^([0-3]?\d[./-][0-1]?\d([./-]\d{2,4})?|\d{4}[./-][0-1]?\d[./-][0-3]?\d)\s*([T\s-]|às\s+|as\s+)?(([01]?\d|2[0-3])[:hH]([0-5]\d)?)/i.test(s)) {
    return true;
  }

  // Text month date
  if (/^([0-3]?\d)\s*(?:de\s+)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:\s*(?:de\s+)?\d{2,4})?/i.test(s)) {
    return true;
  }

  // Date with labels
  if (/^(vencimento|venc|vence|data|data de vencimento|validade|renovacao|renovado|prazo|ate)\b/i.test(s)) {
    return true;
  }

  // Relative offset
  if (/^(\d+\s*(anos?|meses?|dias?))$/i.test(s)) {
    return true;
  }

  return false;
}

export function extractPhoneNumber(text: string): string {
  if (!text) return '';
  const clean = text.replace(/^(whatsapp|whats|wpp|telefone|tel|celular|cel|fone|phone|mobile)\s*[:=-]\s*/i, '').trim();

  // 1) International format starting with +
  const matchInternationalPlus = clean.match(/\+(?:[1-9]\d{0,2})[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);
  if (matchInternationalPlus) {
    return matchInternationalPlus[0].trim();
  }

  // 2) Portugal numbers with DDI 351
  const matchPortugal = clean.match(/\b351[-.\s]?(?:9\d{2}|\d{2})[-.\s]?\d{3}[-.\s]?\d{3,4}\b/);
  if (matchPortugal) {
    return matchPortugal[0].trim();
  }

  // 3) USA / Canada numbers with DDI 1
  const matchUSA = clean.match(/\b1[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}\b/);
  if (matchUSA) {
    return matchUSA[0].trim();
  }

  // 4) Standard Brazil with DDD + number
  const matchWithDDD = clean.match(/(?:\+?55\s*)?(?:\([1-9]{2}\)|[1-9]{2})\s*(?:9\d{4}|\d{4})[-.\s]?\d{4}/);
  if (matchWithDDD) {
    return matchWithDDD[0].trim();
  }

  // 5) 10 or 11 digits continuous or formatted
  const matchDigits = clean.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\d{4}|\d{4})[-.\s]?\d{4}/);
  if (matchDigits) {
    return matchDigits[0].trim();
  }

  // 6) 8 or 9 digits local number
  const matchLocal = clean.match(/\b(?:9\d{4}|\d{4})[-.\s]?\d{4}\b/);
  if (matchLocal) {
    return matchLocal[0].trim();
  }

  return '';
}

export function isPhoneNumber(str: string): boolean {
  if (!str || !str.trim()) return false;
  const s = str.trim();

  if (isExplicitDateString(s)) return false;

  const clean = s.replace(/^(whatsapp|whats|wpp|telefone|tel|celular|cel|fone|phone|mobile)\s*[:=-]\s*/i, '').trim();
  const digits = clean.replace(/\D/g, '');
  const letters = clean.replace(/[^a-zA-ZÀ-ÿ]/g, '');

  if (letters.length > 0) {
    return false;
  }

  return digits.length >= 7 && digits.length <= 15;
}

export function isDateString(str: string): boolean {
  if (!str || !str.trim()) return false;
  return isExplicitDateString(str.trim());
}

export function cleanClientName(name: string): string {
  if (!name) return '';
  return name
    .replace(/^(nome|cliente|empresa|nome\/empresa|raz[aã]o social)\s*[:=-]\s*/i, '')
    .trim();
}

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
  const candPhoneNoDDI = candidatePhoneDigits.replace(/^55/, '');

  return existingClients.find((c) => {
    if (excludeId && c.id === excludeId) return false;

    const existingPhoneDigits = c.phone ? c.phone.replace(/\D/g, '') : '';
    const existPhoneNoDDI = existingPhoneDigits.replace(/^55/, '');

    // 1. If both have valid phone numbers (>= 8 digits):
    if (candPhoneNoDDI.length >= 8 && existPhoneNoDDI.length >= 8) {
      if (candPhoneNoDDI === existPhoneNoDDI) {
        return true;
      }
      return false;
    }

    // 2. If phone is NOT conflicting and name matches:
    if (cleanCandidateName) {
      const cleanExistingName = normalizeNameForComparison(c.name || '');
      if (cleanCandidateName === cleanExistingName) {
        return true;
      }
    }

    return false;
  });
}
