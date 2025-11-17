// Reseta o bucket de Storage usado pela aplicação (apaga e recria)
// Requer variáveis de ambiente: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
// Opcional: STORAGE_BUCKET (padrão: 'checklists')
// Execute: $env:SUPABASE_URL="https://..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm run reset:storage

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.STORAGE_BUCKET || 'checklists';

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function emptyBucket() {
  let page = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit, offset: page * limit, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const names = (data || []).map(o => o.name).filter(Boolean);
    if (!names.length) break;
    const { error: remErr } = await supabase.storage.from(bucket).remove(names);
    if (remErr) throw remErr;
    if (data.length < limit) break;
    page++;
  }
}

async function main() {
  console.log(`Resetando bucket: ${bucket}`);
  try { await emptyBucket(); } catch (e) { console.warn('Falha ao esvaziar bucket (pode não existir):', e.message || e); }
  try { await supabase.storage.deleteBucket(bucket); } catch (_) {}
  const { error } = await supabase.storage.createBucket(bucket, { public: false });
  if (error) throw error;
  console.log('Bucket recriado com sucesso.');
}

main().catch(err => { console.error(err); process.exit(1); });