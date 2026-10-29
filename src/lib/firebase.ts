import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import type { AppData, SystemRestorePoint } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import { logger } from './logger';

export let isQuotaExhausted = false;

export function markQuotaExhausted() {
  isQuotaExhausted = true;
}

export function getIsQuotaExhausted(): boolean {
  return isQuotaExhausted;
}

const firebaseApp = getApps().length === 0
  ? initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    })
  : getApp();

export const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const APP_STATE_DOC_ID = 'main_state';

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

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const docRef = doc(db, 'app_state', APP_STATE_DOC_ID);
    const snap = await getDoc(docRef);
    return snap.exists();
  } catch (e) {
    logger.warn('Firestore test connection notice:', e);
    return false;
  }
}

export async function fetchAppDataFromFirestore(): Promise<AppData | null> {
  try {
    const docRef = doc(db, 'app_state', APP_STATE_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as AppData;
    }
  } catch (err: any) {
    logger.warn('fetchAppDataFromFirestore notice:', err?.message || err);
  }
  return null;
}

export function subscribeToAppData(
  _onData: (data: AppData, exists: boolean) => void,
  _onError?: (err: Error) => void
) {
  // Pull-based synchronization on mount & save to guarantee zero quota exhaustion
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
  // Handled locally
}

export async function saveAppDataToFirestore(data: AppData): Promise<void> {
  try {
    const docRef = doc(db, 'app_state', APP_STATE_DOC_ID);
    const sanitized = sanitizeDataForFirestore(data);
    console.log('Attempting to setDoc in Firestore...', sanitized);
    await setDoc(docRef, sanitized);
    console.log('Successfully setDoc in Firestore.');
  } catch (err: any) {
    console.error('saveAppDataToFirestore FAILED:', err?.message || err);
    logger.warn('saveAppDataToFirestore notice:', err?.message || err);
  }
}

export async function deleteClientFromFirestore(_clientId: string): Promise<void> {
  // Saved in app_state
}

export async function deleteClientsBatchFromFirestore(_clientIds: string[]): Promise<void> {
  // Saved in app_state
}

export async function deleteChargeFromFirestore(_chargeId: string): Promise<void> {
  // Saved in app_state
}

export async function deleteChargesBatchFromFirestore(_chargeIds: string[]): Promise<void> {
  // Saved in app_state
}

export async function deleteSentLogFromFirestore(_logId: string): Promise<void> {
  // Saved in app_state
}

export async function deleteSentLogsBatchFromFirestore(_logIds: string[]): Promise<void> {
  // Saved in app_state
}

export async function fetchRestorePointsFromFirestore(): Promise<SystemRestorePoint[]> {
  try {
    const colRef = collection(db, 'restore_points');
    const snap = await getDocs(colRef);
    const points: SystemRestorePoint[] = [];
    snap.forEach((d) => {
      points.push({ id: d.id, ...d.data() } as SystemRestorePoint);
    });
    if (points.length > 0) {
      try {
        localStorage.setItem('gc_v1_restore_points', JSON.stringify(points));
      } catch {}
      return points;
    }
  } catch (err) {
    logger.warn('fetchRestorePointsFromFirestore notice:', err);
  }

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
  fetchRestorePointsFromFirestore().then((pts) => {
    if (pts.length > 0) onPoints(pts);
  }).catch(() => {});
  return () => {};
}

export async function saveRestorePointToFirestore(point: SystemRestorePoint): Promise<void> {
  try {
    const docRef = doc(db, 'restore_points', point.id);
    await setDoc(docRef, sanitizeDataForFirestore(point));
  } catch (err) {
    logger.warn('saveRestorePointToFirestore notice:', err);
  }

  try {
    const raw = localStorage.getItem('gc_v1_restore_points');
    const points: SystemRestorePoint[] = raw ? JSON.parse(raw) : [];
    const updated = [point, ...points.filter((p) => p.id !== point.id)];
    localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));
  } catch {}
}

export async function deleteRestorePointFromFirestore(pointId: string): Promise<void> {
  try {
    const docRef = doc(db, 'restore_points', pointId);
    await deleteDoc(docRef);
  } catch (err) {
    logger.warn('deleteRestorePointFromFirestore notice:', err);
  }

  try {
    const raw = localStorage.getItem('gc_v1_restore_points');
    const points: SystemRestorePoint[] = raw ? JSON.parse(raw) : [];
    const updated = points.filter((p) => p.id !== pointId);
    localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));
  } catch {}
}
