// Hard reset completo do Storage: apaga todo o conteúdo recursivamente
// e recria o bucket com configuração privada. Policies são aplicadas via SQL
// no arquivo supabase/migrations/storage_policy_hard_reset.sql.
//
// Requer variáveis de ambiente:
// - SUPABASE_URL (ou VITE_SUPABASE_URL)
// - SUPABASE_SERVICE_ROLE_KEY (chave service role)
// - STORAGE_BUCKET (opcional, padrão: 'checklists')
//
// Uso (PowerShell):
//   $env:SUPABASE_URL="https://xxxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="service-role-key"
//   npm run reset:storage:hard

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.STORAGE_BUCKET || 'checklists';

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function listAllPaths(prefix = '') {
  const acc = [];
  const limit = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const items = data || [];
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name;
      // Heurística: arquivos possuem id/metadata; pastas não
      const isFile = !!(it.id || (it.metadata && typeof it.metadata.size === 'number'));
      if (isFile) acc.push(path);
      else {
        // pasta: descer recursivamente
        const nested = await listAllPaths(path);
        acc.push(...nested);
      }
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return acc;
}

async function emptyBucketDeep() {
  console.log('Listando arquivos para remoção…');
  const paths = await listAllPaths('');
  console.log(`Arquivos encontrados: ${paths.length}`);
  // Remover em lotes para evitar payloads grandes
  const chunkSize = 1000;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const batch = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw error;
    console.log(`Removidos ${Math.min(paths.length, i + chunkSize)} / ${paths.length}`);
  }
}

async function main() {
  console.log(`Hard reset do Storage: bucket='${bucket}'`);
  try {
    // Tentar esvaziar o bucket recursivamente
    await emptyBucketDeep();
  } catch (e) {
    console.warn('Aviso ao esvaziar bucket (pode não existir):', e?.message || e);
  }
  try {
    await supabase.storage.deleteBucket(bucket);
    console.log('Bucket removido.');
  } catch (e) {
    console.warn('Aviso ao remover bucket (pode não existir):', e?.message || e);
  }
  const { error } = await supabase.storage.createBucket(bucket, { public: false });
  if (error) throw error;
  console.log('Bucket recriado como privado.');
  console.log('Agora aplique policies via SQL: supabase/migrations/storage_policy_hard_reset.sql');
}

main().catch(err => { console.error(err); process.exit(1); });