// Apaga TODOS os usuários de Auth do projeto Supabase
// Requer variáveis de ambiente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
// Execute: $env:SUPABASE_URL="https://..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run reset:auth

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function listAllUsers() {
  const all = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    all.push(...users);
    if (users.length < perPage) break;
    page++;
  }
  return all;
}

async function main() {
  console.log('Listando usuários...');
  const users = await listAllUsers();
  console.log(`Encontrados ${users.length} usuários.`);
  for (const u of users) {
    console.log(`Apagando usuário: ${u.id} ${u.email || ''}`);
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.error(`Falha ao apagar ${u.id}:`, error.message);
  }
  console.log('Concluído.');
}

main().catch(err => { console.error(err); process.exit(1); });