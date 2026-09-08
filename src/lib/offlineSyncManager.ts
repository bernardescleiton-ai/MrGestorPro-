import { logger } from './logger';
import {
  deleteClientFromFirestore,
  deleteClientsBatchFromFirestore,
  deleteChargeFromFirestore,
  deleteChargesBatchFromFirestore,
  deleteSentLogFromFirestore,
  deleteSentLogsBatchFromFirestore,
  saveAppDataToFirestore,
} from './firebase';
import type { AppData } from '../types';

const DELETION_QUEUE_KEY = 'gc_pending_deletions_v1';
const PENDING_SYNC_FLAG_KEY = 'gc_pending_sync_flag_v1';

export interface PendingDeletions {
  clients: string[];
  charges: string[];
  logs: string[];
}

export function getPendingDeletions(): PendingDeletions {
  try {
    const raw = localStorage.getItem(DELETION_QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        clients: Array.isArray(parsed.clients) ? parsed.clients : [],
        charges: Array.isArray(parsed.charges) ? parsed.charges : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    }
  } catch (e) {
    logger.error('Error reading pending deletions:', e);
  }
  return { clients: [], charges: [], logs: [] };
}

function savePendingDeletions(deletions: PendingDeletions): void {
  try {
    localStorage.setItem(DELETION_QUEUE_KEY, JSON.stringify(deletions));
  } catch (e) {
    logger.error('Error saving pending deletions:', e);
  }
}

export function trackClientDeletion(id: string): void {
  if (!id) return;
  const current = getPendingDeletions();
  if (!current.clients.includes(id)) {
    current.clients.push(id);
    savePendingDeletions(current);
  }
  markHasPendingLocalChanges();
}

export function trackClientsBatchDeletion(ids: string[]): void {
  if (!ids || !ids.length) return;
  const current = getPendingDeletions();
  let changed = false;
  for (const id of ids) {
    if (id && !current.clients.includes(id)) {
      current.clients.push(id);
      changed = true;
    }
  }
  if (changed) {
    savePendingDeletions(current);
  }
  markHasPendingLocalChanges();
}

export function trackChargeDeletion(id: string): void {
  if (!id) return;
  const current = getPendingDeletions();
  if (!current.charges.includes(id)) {
    current.charges.push(id);
    savePendingDeletions(current);
  }
  markHasPendingLocalChanges();
}

export function trackChargesBatchDeletion(ids: string[]): void {
  if (!ids || !ids.length) return;
  const current = getPendingDeletions();
  let changed = false;
  for (const id of ids) {
    if (id && !current.charges.includes(id)) {
      current.charges.push(id);
      changed = true;
    }
  }
  if (changed) {
    savePendingDeletions(current);
  }
  markHasPendingLocalChanges();
}

export function trackLogDeletion(id: string): void {
  if (!id) return;
  const current = getPendingDeletions();
  if (!current.logs.includes(id)) {
    current.logs.push(id);
    savePendingDeletions(current);
  }
  markHasPendingLocalChanges();
}

export function markHasPendingLocalChanges(): void {
  try {
    localStorage.setItem(PENDING_SYNC_FLAG_KEY, 'true');
  } catch {}
}

export function clearPendingLocalChangesFlag(): void {
  try {
    localStorage.removeItem(PENDING_SYNC_FLAG_KEY);
  } catch {}
}

export function hasPendingLocalChanges(): boolean {
  try {
    return localStorage.getItem(PENDING_SYNC_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

// Synchronize pending offline deletions to Cloud Firestore
export async function flushPendingDeletionsToFirestore(): Promise<void> {
  const pending = getPendingDeletions();
  if (!pending.clients.length && !pending.charges.length && !pending.logs.length) {
    return;
  }

  // 1. Clients
  if (pending.clients.length > 0) {
    try {
      if (pending.clients.length === 1) {
        await deleteClientFromFirestore(pending.clients[0]);
      } else {
        await deleteClientsBatchFromFirestore(pending.clients);
      }
      pending.clients = [];
    } catch (e) {
      logger.warn('Pending client deletions sync notice:', e);
    }
  }

  // 2. Charges
  if (pending.charges.length > 0) {
    try {
      if (pending.charges.length === 1) {
        await deleteChargeFromFirestore(pending.charges[0]);
      } else {
        await deleteChargesBatchFromFirestore(pending.charges);
      }
      pending.charges = [];
    } catch (e) {
      logger.warn('Pending charge deletions sync notice:', e);
    }
  }

  // 3. Logs
  if (pending.logs.length > 0) {
    try {
      if (pending.logs.length === 1) {
        await deleteSentLogFromFirestore(pending.logs[0]);
      } else {
        await deleteSentLogsBatchFromFirestore(pending.logs);
      }
      pending.logs = [];
    } catch (e) {
      logger.warn('Pending log deletions sync notice:', e);
    }
  }

  savePendingDeletions(pending);
}

// Full offline-to-online synchronization push
export async function syncLocalStateToFirebase(data: AppData): Promise<boolean> {
  try {
    // First flush pending deletions
    await flushPendingDeletionsToFirestore();

    // Then push current full local dataset to Firestore
    await saveAppDataToFirestore(data);

    // Clear pending flag on successful push
    clearPendingLocalChangesFlag();
    return true;
  } catch (err) {
    logger.warn('Error syncing local state to Firebase:', err);
    return false;
  }
}
