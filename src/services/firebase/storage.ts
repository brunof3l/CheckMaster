import { getFirebaseApp } from './app';
import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';

export function uploadWithProgress(path: string, file: File, onProgress: (pct: number) => void) {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase não configurado');
  const storage = getStorage(app);
  const r = ref(storage, path);
  const task = uploadBytesResumable(r, file);
  return new Promise<string>((resolve, reject) => {
    task.on('state_changed', (snap) => {
      const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      onProgress(pct);
    }, reject, async () => {
      resolve(path);
    });
  });
}