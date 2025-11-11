import { httpsCallable, getFunctions } from 'firebase/functions';
import { getFirebaseApp } from './firebase/app';

export async function generateChecklistPdf(id: string) {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase não configurado');
  const fn = httpsCallable(getFunctions(app), 'generateChecklistPdf');
  const res: any = await fn({ id });
  return res.data?.url as string;
}