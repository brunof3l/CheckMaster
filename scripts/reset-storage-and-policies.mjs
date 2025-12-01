// Script único: reseta o bucket de Storage e aplica as policies via SQL
// Requer variáveis de ambiente:
// - SUPABASE_URL (ou VITE_SUPABASE_URL)
// - SUPABASE_SERVICE_ROLE_KEY (service role key)
// - SUPABASE_DB_URL (connection string Postgres do projeto)
// - STORAGE_BUCKET (opcional, padrão 'checklists')
//
// Uso (PowerShell):
//   $env:SUPABASE_URL="https://xxxxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="service-role-key"
//   $env:SUPABASE_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
//   npm run reset:storage:one
//
// Observação: este script lê e executa o arquivo SQL em
//   supabase/migrations/storage_policy_hard_reset.sql
// e força o papel 'supabase_admin' para evitar o erro
//   "ERROR: 42501: must be owner of table objects".

import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Usaremos 'pg' para executar SQL diretamente no Postgres
// Certifique-se de instalar: npm i pg
import pg from 'pg';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const bucket = process.env.STORAGE_BUCKET || 'checklists';

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.');
  process.exit(1);
}
if (!dbUrl) {
  console.error('Defina SUPABASE_DB_URL com a string de conexão Postgres do projeto.');
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
      const isFile = !!(it.id || (it.metadata && typeof it.metadata.size === 'number'));
      if (isFile) acc.push(path);
      else {
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
  const chunkSize = 1000;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const batch = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw error;
    console.log(`Removidos ${Math.min(paths.length, i + chunkSize)} / ${paths.length}`);
  }
}

async function resetBucket() {
  console.log(`Hard reset do Storage: bucket='${bucket}'`);
  try {
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
}

async function applyPolicies() {
  const sqlFile = path.resolve(process.cwd(), 'supabase/migrations/storage_policy_hard_reset.sql');
  console.log(`Lendo SQL: ${sqlFile}`);
  const sqlContent = await fs.readFile(sqlFile, 'utf-8');
  // Prefixar SET ROLE para garantir permissões de owner nas tabelas do storage
  const sql = `SET ROLE supabase_admin;\n${sqlContent}`;

  console.log('Conectando ao Postgres para aplicar policies…');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('BEGIN;');
    await client.query(sql);
    await client.query('COMMIT;');
    console.log('Policies aplicadas com sucesso.');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Falha ao aplicar policies:', err?.message || err);
    throw err;
  } finally {
    await client.end();
  }
}

async function main() {
  await resetBucket();
  await applyPolicies();
  console.log('Concluído: bucket resetado e policies aplicadas.');
}

main().catch(err => { console.error(err); process.exit(1); });

