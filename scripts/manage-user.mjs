// Admin: gerenciar usuário por e-mail (purge, reativar, desativar)
// Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.
// Uso:
//   node scripts/manage-user.mjs purge --email "user@dominio.com"
//   node scripts/manage-user.mjs reactivate --email "user@dominio.com" --name "Nome" --role "user"
//   node scripts/manage-user.mjs deactivate --email "user@dominio.com"
//   node scripts/manage-user.mjs status --email "user@dominio.com"

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function parseArgs() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i];
    if (k === '--email') { args.email = rest[++i]; }
    else if (k === '--name') { args.name = rest[++i]; }
    else if (k === '--role') { args.role = rest[++i]; }
  }
  return { cmd, args };
}

async function getUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  const target = email.toLowerCase();
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find(u => (u.email || '').toLowerCase() === target);
    if (found) return found;
    if (users.length < perPage) break;
    page++;
  }
  return null;
}

async function purgeUser(email) {
  const user = await getUserByEmail(email);
  if (!user) {
    console.log('Usuário não encontrado no Auth. Prosseguindo apenas com limpeza no Primary.');
  } else {
    const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;
    console.log(`Auth: usuário ${user.id} (${user.email}) removido.`);
  }
  // Limpeza no Primary Database (bypass RLS com service role)
  const uid = user?.id || null;
  if (uid) {
    const { error: aErr } = await supabase.from('checklist_audit').delete().eq('user_id', uid);
    if (aErr) throw aErr;
    const { error: cErr } = await supabase.from('checklists').delete().eq('created_by', uid);
    if (cErr) throw cErr;
  }
  const lowerEmail = email.toLowerCase();
  let uErr;
  if (uid) {
    ({ error: uErr } = await supabase.from('users').delete().eq('id', uid));
  } else {
    ({ error: uErr } = await supabase.from('users').delete().eq('email', lowerEmail));
  }
  if (uErr) throw uErr;
  console.log('Primary: perfil e dados vinculados removidos.');
}

async function reactivateUser(email, name, role = 'editor') {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('Usuário não encontrado no Auth. Crie o cadastro ou recupere a senha.');
  const payload = { id: user.id, email: user.email, display_name: name || null, role: role || 'editor', is_active: true };
  const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  console.log(`Perfil reativado/criado para ${user.email} (is_active=true, role=${payload.role}, display_name=${payload.display_name || ''}).`);
}

async function deactivateUser(email) {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('Usuário não encontrado no Auth.');
  const { error } = await supabase.from('users').update({ is_active: false }).eq('id', user.id);
  if (error) throw error;
  console.log(`Perfil ${user.email} marcado como inativo (is_active=false).`);
}

async function statusUser(email) {
  const user = await getUserByEmail(email);
  const uid = user?.id || null;
  console.log('Auth:', user ? { id: user.id, email: user.email } : 'não encontrado');
  if (uid) {
    const { data: prof } = await supabase.from('users').select('id,email,is_active,role,display_name').eq('id', uid).limit(1).maybeSingle();
    console.log('Primary:', prof || 'perfil não encontrado');
  } else {
    const { data: profByEmail } = await supabase.from('users').select('id,email,is_active,role,display_name').eq('email', email).limit(1).maybeSingle();
    console.log('Primary:', profByEmail || 'perfil não encontrado');
  }
}

async function main() {
  const { cmd, args } = parseArgs();
  if (!['purge', 'reactivate', 'deactivate', 'status'].includes(cmd)) {
    console.log('Comandos: purge | reactivate | deactivate | status');
    console.log('Ex.: node scripts/manage-user.mjs purge --email "user@dominio.com"');
    process.exit(1);
  }
  if (!args.email) {
    console.error('Informe --email');
    process.exit(1);
  }
  if (cmd === 'purge') await purgeUser(args.email);
  else if (cmd === 'reactivate') await reactivateUser(args.email, args.name, args.role);
  else if (cmd === 'deactivate') await deactivateUser(args.email);
  else if (cmd === 'status') await statusUser(args.email);
}

main().catch(err => { console.error(err?.message || err); process.exit(1); });