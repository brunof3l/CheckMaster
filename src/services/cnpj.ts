import { httpsCallable, getFunctions } from 'firebase/functions';
import { getFirebaseApp } from './firebase/app';
import { useState } from 'react';

export function useCnpjService() {
  const [loading, setLoading] = useState(false);
  const lookup = async (cnpj: string) => {
    const app = getFirebaseApp();
    if (!app) { alert('Firebase não configurado'); return null; }
    setLoading(true);
    try {
      const fn = httpsCallable(getFunctions(app), 'cnpjLookup');
      const res: any = await fn({ cnpj });
      return res.data;
    } catch (e: any) { alert(e.message); return null; } finally { setLoading(false); }
  };
  return { lookup, loading };
}