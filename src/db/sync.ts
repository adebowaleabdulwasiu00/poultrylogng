import { collection, doc, setDoc, deleteDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { getFirestoreDB, isFirebaseConfigured } from './firebase';
import { db, getActiveFarmId } from './database';
import type { SyncQueue } from './types';

const COLLECTION_MAP: Record<string, string> = {
  batches: 'batches',
  dailyReports: 'dailyReports',
  products: 'products',
  purchases: 'purchases',
  sales: 'sales',
  customers: 'customers',
  customerPayments: 'customerPayments',
  suppliers: 'suppliers',
  supplierPayments: 'supplierPayments',
  supplierAdjustments: 'supplierAdjustments',
  banks: 'banks',
  paymentMethods: 'paymentMethods',
  productCategories: 'productCategories',
  units: 'units',
  salesHeaders: 'salesHeaders',
  salesDetails: 'salesDetails',
  purchaseHeaders: 'purchaseHeaders',
  purchaseDetails: 'purchaseDetails',
};

export async function queueSync(collectionName: string, recordId: number, operation: 'create' | 'update' | 'delete', data: unknown) {
  const farmId = await getActiveFarmId();
  await db.syncQueue.add({
    farmId,
    collection: collectionName,
    recordId,
    operation,
    data,
    createdAt: new Date().toISOString(),
    retries: 0,
    status: 'pending',
  });
}

export async function processSyncQueue() {
  if (!isFirebaseConfigured()) return;
  const fdb = getFirestoreDB();
  if (!fdb) return;

  const pending = await db.syncQueue.where('status').equals('pending').toArray();

  for (const item of pending) {
    try {
      await db.syncQueue.update(item.id!, { status: 'processing' });
      const firestoreCollection = COLLECTION_MAP[item.collection];
      if (!firestoreCollection) {
        await db.syncQueue.update(item.id!, { status: 'failed' });
        continue;
      }

      const docRef = doc(fdb, firestoreCollection, String(item.recordId));

      if (item.operation === 'delete') {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, { ...(item.data as object), id: item.recordId }, { merge: true });
      }

      const table = db[item.collection as keyof typeof db] as any;
      if (table && item.operation !== 'delete') {
        await table.update(item.recordId, { syncStatus: 'synced' });
      }

      await db.syncQueue.delete(item.id!);
    } catch {
      const retries = (item.retries || 0) + 1;
      await db.syncQueue.update(item.id!, {
        status: retries >= 5 ? 'failed' : 'pending',
        retries,
      });
    }
  }
}

export async function pullRemoteUpdates() {
  if (!isFirebaseConfigured()) return;
  const fdb = getFirestoreDB();
  if (!fdb) return;

  for (const [localTable, remoteCollection] of Object.entries(COLLECTION_MAP)) {
    try {
      const snapshot = await getDocs(collection(fdb, remoteCollection));
      const table = db[localTable as keyof typeof db] as any;
      if (!table) continue;

      for (const docSnap of snapshot.docs) {
        const remoteData = docSnap.data();
        const existing = await table.get(Number(docSnap.id));
        if (existing) {
          if (remoteData.updatedAt > existing.updatedAt && existing.syncStatus !== 'pending') {
            await table.update(Number(docSnap.id), { ...remoteData, syncStatus: 'synced' });
          }
        } else {
          await table.add({ ...remoteData, id: Number(docSnap.id), syncStatus: 'synced' });
        }
      }
    } catch {
      // Silently fail for offline mode
    }
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSync(intervalMs = 30000) {
  stopAutoSync();
  processSyncQueue();
  syncInterval = setInterval(() => {
    processSyncQueue();
    pullRemoteUpdates();
  }, intervalMs);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export async function retryFailedSync() {
  await db.syncQueue.where('status').equals('failed').modify({ status: 'pending', retries: 0 });
  processSyncQueue();
}
