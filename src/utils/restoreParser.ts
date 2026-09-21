import { Client, Charge, CompanySettings } from '../types';

export interface ParsedRestoreData {
  clients: Client[];
  charges: Charge[];
  settings?: CompanySettings;
  name?: string;
  createdAt?: string;
}

function decodeRawInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  try {
    return decodeURIComponent(escape(atob(trimmed)));
  } catch {
    return trimmed;
  }
}

function parseFromRestorePointObject(obj: Record<string, unknown>): ParsedRestoreData | null {
  if (!obj.data || typeof obj.data !== 'object') return null;
  const d = obj.data as Record<string, unknown>;
  const clients = Array.isArray(d.clients) ? (d.clients as Client[]) : [];
  const charges = Array.isArray(d.charges) ? (d.charges as Charge[]) : [];
  const settings = d.settings && typeof d.settings === 'object' ? (d.settings as CompanySettings) : undefined;
  if (!clients.length && !charges.length && !settings) return null;
  return {
    clients,
    charges,
    settings,
    name: typeof obj.name === 'string' ? obj.name : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
  };
}

function parseFromBackupObject(obj: Record<string, unknown>): ParsedRestoreData | null {
  if (!Array.isArray(obj.clients) && !Array.isArray(obj.charges) && !obj.settings) return null;
  return {
    clients: Array.isArray(obj.clients) ? (obj.clients as Client[]) : [],
    charges: Array.isArray(obj.charges) ? (obj.charges as Charge[]) : [],
    settings: obj.settings && typeof obj.settings === 'object' ? (obj.settings as CompanySettings) : undefined,
    name: typeof obj.name === 'string' ? obj.name : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : (typeof obj.exportedAt === 'string' ? obj.exportedAt : undefined),
  };
}

export function parseExternalRestoreData(rawText: string): ParsedRestoreData | null {
  if (!rawText?.trim()) return null;
  try {
    const parsed = JSON.parse(decodeRawInput(rawText));
    if (!parsed) return null;
    if (Array.isArray(parsed)) {
      return { clients: parsed as Client[], charges: [] };
    }
    if (typeof parsed !== 'object') return null;
    return parseFromRestorePointObject(parsed as Record<string, unknown>) || parseFromBackupObject(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}
