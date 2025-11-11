import { initializeApp } from 'firebase/app';

let appInstance: ReturnType<typeof initializeApp> | null = null;

export function getFirebaseApp() {
  if (appInstance) return appInstance;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) return null;
  appInstance = initializeApp({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId });
  return appInstance;
}