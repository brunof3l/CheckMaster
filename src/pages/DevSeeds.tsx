import { useState } from 'react';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { getFirebaseApp } from '../services/firebase/app';

export function DevSeeds() {
  const [message, setMessage] = useState('');
  const app = getFirebaseApp();
  const canSeed = !!app;
  const run = async () => {
    if (!app) { setMessage('Configure Firebase para executar seeds.'); return; }
    const db = getFirestore(app);
    await addDoc(collection(db, 'check_items'), { name: 'Freio', order: 1 });
    await addDoc(collection(db, 'check_items'), { name: 'Pneu', order: 2 });
    await addDoc(collection(db, 'vehicles'), { plate: 'ABC1D23', model: 'Hatch', brand: 'Marca', year: 2020, color: 'Prata', createdAt: Date.now() });
    await addDoc(collection(db, 'suppliers'), { cnpj: '00.000.000/0000-00', razaoSocial: 'Fornecedor Exemplo', nomeFantasia: 'Fornecedor', createdAt: Date.now() });
    setMessage('Seeds criadas.');
  };
  return (
    <div className="py-3">
      <button className="py-2 px-3 border rounded" onClick={run} disabled={!canSeed}>Rodar seeds</button>
      <div className="text-xs mt-2">{message}</div>
    </div>
  );
}