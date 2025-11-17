import { useState } from 'react';
import { supabase } from '../config/supabase';

export function DevSeeds() {
  const [message, setMessage] = useState('');
  const canSeed = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  const run = async () => {
    try {
      await supabase.from('check_items').insert([{ name: 'Freio' }, { name: 'Pneu' }]);
      await supabase.from('vehicles').insert([{ plate: 'ABC1D23', model: 'Hatch', brand: 'Marca', year: 2020 }]);
      await supabase.from('suppliers').insert([{ cnpj: '00.000.000/0000-00', nome: 'Fornecedor Exemplo', telefone: '', email: '' }]);
      setMessage('Seeds criadas.');
    } catch (e: any) { setMessage(e?.message || 'Falha ao criar seeds'); }
  };
  return (
    <div className="py-3">
      <button className="py-2 px-3 border rounded" onClick={run} disabled={!canSeed}>Rodar seeds</button>
      <div className="text-xs mt-2">{message}</div>
    </div>
  );
}