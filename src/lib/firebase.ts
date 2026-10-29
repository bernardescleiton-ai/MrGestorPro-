import { AppData, SystemRestorePoint } from '../types';

export let isQuotaExhausted = true;

export function markQuotaExhausted() {
  isQuotaExhausted = true;
}

export function getIsQuotaExhausted(): boolean {
  return true;
}

export const db = null;

export async function testFirestoreConnection(): Promise<boolean> {
  return false;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function sanitizeDataForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDataForFirestore);
  }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        sanitized[key] = sanitizeDataForFirestore(val);
      }
    }
    return sanitized;
  }
  return obj;
}

export async function fetchAppDataFromFirestore(): Promise<AppData | null> {
  return null;
}

export function subscribeToAppData(
  _onData: (data: AppData, exists: boolean) => void,
  _onError?: (err: Error) => void
) {
  return () => {};
}

export const cloudClientsCache = new Map<string, string>();
export const cloudChargesCache = new Map<string, string>();
export const cloudLogsCache = new Map<string, string>();

export function canonicalJson(obj: any): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    const hasIds = obj.length > 0 && obj[0] && typeof obj[0] === 'object' && 'id' in obj[0];
    const items = hasIds
      ? [...obj].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')))
      : obj;
    return '[' + items.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const val = obj[k];
    if (val !== undefined && val !== null && val !== '') {
      pairs.push(JSON.stringify(k) + ':' + canonicalJson(val));
    }
  }
  return '{' + pairs.join(',') + '}';
}

export async function deleteWhatsAppMediaFromCloud(): Promise<void> {
  // Local only
}

export async function saveAppDataToFirestore(_data: AppData): Promise<void> {
  // Local only
}

export async function deleteClientFromFirestore(_clientId: string): Promise<void> {
  // Local only
}

export async function deleteClientsBatchFromFirestore(_clientIds: string[]): Promise<void> {
  // Local only
}

export async function deleteChargeFromFirestore(_chargeId: string): Promise<void> {
  // Local only
}

export async function deleteChargesBatchFromFirestore(_chargeIds: string[]): Promise<void> {
  // Local only
}

export async function deleteSentLogFromFirestore(_logId: string): Promise<void> {
  // Local only
}

export async function deleteSentLogsBatchFromFirestore(_logIds: string[]): Promise<void> {
  // Local only
}

export async function fetchRestorePointsFromFirestore(): Promise<SystemRestorePoint[]> {
  try {
    const raw = localStorage.getItem('gc_v1_restore_points');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function subscribeToRestorePoints(
  onPoints: (points: SystemRestorePoint[]) => void,
  _onError?: (err: Error) => void
) {
  try {
    const raw = localStorage.getItem('gc_v1_restore_points');
    if (raw) onPoints(JSON.parse(raw));
  } catch {}
  return () => {};
}

export async function saveRestorePointToFirestore(point: SystemRestorePoint): Promise<void> {
  try {
    const raw = localStorage.getItem('gc_v1_restore_points');
    const points: SystemRestorePoint[] = raw ? JSON.parse(raw) : [];
    const updated = [point, ...points.filter(p => p.id !== point.id)];
    localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));
  } catch {}
}

export async function deleteRestorePointFromFirestore(pointId: string): Promise<void> {
  try {
    const raw = localStorage.getItem('gc_v1_restore_points');
    const points: SystemRestorePoint[] = raw ? JSON.parse(raw) : [];
    const updated = points.filter(p => p.id !== pointId);
    localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));
  } catch {}
}
