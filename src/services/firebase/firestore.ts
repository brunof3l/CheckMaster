import { getFirebaseApp } from './app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

let db: ReturnType<typeof getFirestore> | null = null;
export function getDB() {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!db) {
    db = getFirestore(app);
    enableIndexedDbPersistence(db).catch(() => {});
  }
  return db;
}