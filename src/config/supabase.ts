import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  const msg = 'Configuração do Supabase ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env';
  console.error(msg);
  try { alert(msg); } catch {}
  throw new Error(msg);
}

export const supabase = createClient(
  url,
  anonKey,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);