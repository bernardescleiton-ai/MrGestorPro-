import { Client, Charge, SentMessageLog } from '../types';

/**
 * Normalizes phone numbers for matching (removes non-digits and optional leading 55)
 */
export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.replace(/^55/, '');
}

/**
 * Normalizes client names for fuzzy/case-insensitive comparison
 */
export function cleanClientName(name?: string | null): string {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Fast lookup context for O(1) matching across multiple dimensions
 */
export interface ClientLookupContext {
  idMap: Map<string, Client>;
  phoneMap: Map<string, Client>;
  nameMap: Map<string, Client>;
  logChargeMap: Map<string, SentMessageLog>;
  logClientMap: Map<string, SentMessageLog>;
}

/**
 * Builds indexing structures for fast client resolution
 */
export function buildClientLookupContext(
  clients: Client[],
  sentLogs?: SentMessageLog[]
): ClientLookupContext {
  const idMap = new Map<string, Client>();
  const phoneMap = new Map<string, Client>();
  const nameMap = new Map<string, Client>();
  const logChargeMap = new Map<string, SentMessageLog>();
  const logClientMap = new Map<string, SentMessageLog>();

  const safeClients = Array.isArray(clients) ? clients : [];
  for (let i = 0; i < safeClients.length; i++) {
    const c = safeClients[i];
    if (!c) continue;
    if (c.id) {
      idMap.set(c.id, c);
      idMap.set(c.id.trim(), c);
      idMap.set(c.id.toLowerCase(), c);
    }
    const cleanPhone = cleanPhoneNumber(c.phone);
    if (cleanPhone.length >= 8) {
      phoneMap.set(cleanPhone, c);
    }
    const cleanName = cleanClientName(c.name);
    if (cleanName) {
      nameMap.set(cleanName, c);
    }
  }

  const safeLogs = Array.isArray(sentLogs) ? sentLogs : [];
  for (let i = safeLogs.length - 1; i >= 0; i--) {
    const log = safeLogs[i];
    if (!log) continue;
    if (log.chargeId && !logChargeMap.has(log.chargeId)) {
      logChargeMap.set(log.chargeId, log);
    }
    if (log.clientId && !logClientMap.has(log.clientId)) {
      logClientMap.set(log.clientId, log);
    }
  }

  return { idMap, phoneMap, nameMap, logChargeMap, logClientMap };
}

/**
 * Resolves the genuine Client record associated with a charge.
 * Exhaustively checks:
 * 1. Direct ID match
 * 2. Trimmed / case-insensitive ID match
 * 3. Phone matching (if clientId contains a phone number)
 * 4. SentMessageLog history by chargeId or clientId (matching by phone or name)
 * 5. Direct properties on charge (.clientName, .clientPhone)
 * 6. Note matching against client names
 * 7. Fallback synthetic client object from logs/metadata so client name is never missing
 */
export function resolveClientForCharge(
  ch: Charge,
  clientMapOrContext: Map<string, Client> | ClientLookupContext,
  clients?: Client[],
  sentLogs?: SentMessageLog[]
): Client | undefined {
  if (!ch) return undefined;

  let ctx: ClientLookupContext;
  if ('idMap' in clientMapOrContext) {
    ctx = clientMapOrContext as ClientLookupContext;
  } else {
    ctx = buildClientLookupContext(clients || Array.from(clientMapOrContext.values()), sentLogs);
  }

  const rawId = ch.clientId ? String(ch.clientId) : '';
  const trimmedId = rawId.trim();

  // 1. Direct and trimmed ID match
  if (trimmedId) {
    const direct = ctx.idMap.get(trimmedId) || ctx.idMap.get(rawId) || ctx.idMap.get(trimmedId.toLowerCase());
    if (direct) return direct;
  }

  // 2. Phone match if clientId is formatted as digits/phone
  const cleanIdDigits = cleanPhoneNumber(trimmedId);
  if (cleanIdDigits.length >= 8 && ctx.phoneMap.has(cleanIdDigits)) {
    return ctx.phoneMap.get(cleanIdDigits);
  }

  // 3. Sent Logs lookup by charge ID or client ID
  const matchedLog =
    (ch.id ? ctx.logChargeMap.get(ch.id) : undefined) ||
    (trimmedId ? ctx.logClientMap.get(trimmedId) : undefined);

  if (matchedLog) {
    if (matchedLog.clientId && ctx.idMap.has(matchedLog.clientId)) {
      return ctx.idMap.get(matchedLog.clientId);
    }
    const logPhone = cleanPhoneNumber(matchedLog.phone);
    if (logPhone.length >= 8 && ctx.phoneMap.has(logPhone)) {
      return ctx.phoneMap.get(logPhone);
    }
    const logName = cleanClientName(matchedLog.clientName);
    if (logName && ctx.nameMap.has(logName)) {
      return ctx.nameMap.get(logName);
    }
    if (matchedLog.clientName && matchedLog.clientName.trim()) {
      return {
        id: trimmedId || matchedLog.clientId || ch.id,
        name: matchedLog.clientName.trim(),
        phone: matchedLog.phone || '',
        dueDate: ch.dueDate,
        createdAt: ch.createdAt,
      };
    }
  }

  // 4. Any direct property on charge (e.g. clientName or clientPhone)
  const chRecord = ch as unknown as Record<string, unknown>;
  const clientPhoneProp = typeof chRecord.clientPhone === 'string' ? chRecord.clientPhone : undefined;
  const clientNameProp = typeof chRecord.clientName === 'string' ? chRecord.clientName : undefined;

  if (clientPhoneProp) {
    const p = cleanPhoneNumber(clientPhoneProp);
    if (p.length >= 8 && ctx.phoneMap.has(p)) return ctx.phoneMap.get(p);
  }
  if (clientNameProp && clientNameProp.trim()) {
    const n = cleanClientName(clientNameProp);
    if (n && ctx.nameMap.has(n)) return ctx.nameMap.get(n);
    return {
      id: trimmedId || ch.id,
      name: clientNameProp.trim(),
      phone: clientPhoneProp ? clientPhoneProp.trim() : '',
      dueDate: ch.dueDate,
      createdAt: ch.createdAt,
    };
  }

  // 5. Note matching (if note contains a client name)
  if (ch.note && ch.note !== 'Vencimento do Cliente' && ch.note !== 'Mensalidade do Cliente') {
    const cleanNote = cleanClientName(ch.note);
    if (cleanNote) {
      if (ctx.nameMap.has(cleanNote)) return ctx.nameMap.get(cleanNote);
      for (const [nameKey, client] of ctx.nameMap.entries()) {
        if (cleanNote.includes(nameKey) && nameKey.length >= 4) {
          return client;
        }
      }
    }
  }

  return undefined;
}
