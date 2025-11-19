-- Hard reset das policies do Storage para o bucket 'checklists'
-- Execute este arquivo no SQL Editor do Supabase (projeto atual)
-- Isso remove políticas redundantes e recria apenas as essenciais

-- Garantir RLS habilitado
alter table if exists storage.objects enable row level security;

-- Remover políticas antigas conhecidas (sem erro se não existirem)
drop policy if exists "public read" on storage.objects;
drop policy if exists "auth insert" on storage.objects;
drop policy if exists "auth update" on storage.objects;
drop policy if exists "auth delete" on storage.objects;
drop policy if exists public_read_checklists on storage.objects;
drop policy if exists authenticated_insert_checklists on storage.objects;
drop policy if exists authenticated_update_checklists on storage.objects;
drop policy if exists authenticated_delete_checklists on storage.objects;
drop policy if exists storage_insert_checklists on storage.objects;
drop policy if exists storage_select_checklists on storage.objects;
drop policy if exists storage_delete_admin on storage.objects;

-- Políticas mínimas, alinhadas ao código atual:
-- 1) INSERT para usuários autenticados (apenas bucket 'checklists')
create policy storage_insert_checklists
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'checklists');

-- 2) SELECT para usuários autenticados (apenas bucket 'checklists')
create policy storage_select_checklists
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'checklists');

-- 3) DELETE somente admin (apenas bucket 'checklists')
-- Usa checagem de função de role administradora já existente na base
-- Se sua função/visão de admin for diferente, ajuste o EXISTS abaixo
create policy storage_delete_admin
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'checklists'
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Observações:
-- - Mantemos o bucket como privado: uploads/leitura via URLs assinadas no app.
-- - Não criamos UPDATE no Storage: não é necessário para o fluxo atual.
-- - Se precisar permitir leitura pública, crie uma policy SELECT para 'public'.