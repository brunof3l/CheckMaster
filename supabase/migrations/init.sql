-- Supabase migration: initial schema for CheckMaster
-- Run in Supabase SQL Editor

-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- Users (app profile store; separate from auth.users)
create table if not exists public.users (
  id uuid primary key,
  email text,
  display_name text,
  role text default 'editor',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Vehicles
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text unique,
  model text,
  brand text,
  year int,
  photo text,
  created_at timestamptz default now()
);

-- Add vehicle type column (if missing)
alter table if exists public.vehicles
  add column if not exists type text;

-- Suppliers
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  cnpj text,
  nome text,
  razaoSocial text,
  telefone text,
  email text,
  created_at timestamptz default now()
);

-- Check items
create table if not exists public.check_items (
  id uuid primary key default gen_random_uuid(),
  name text,
  order_n int default 0
);

-- Checklists
create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  seq text,
  plate text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  service text,
  defect_items jsonb default '[]'::jsonb,
  media jsonb default '[]'::jsonb,
  budgetAttachments jsonb default '[]'::jsonb,
  fuelGaugePhotos jsonb default '{}'::jsonb,
  status text default 'rascunho',
  created_by uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

-- CNPJ cache
create table if not exists public.cnpj_cache (
  cnpj text primary key,
  data jsonb,
  cached_at timestamptz default now()
);

-- Sequence and function for checklist seq
create sequence if not exists public.checklist_seq start 1;

create or replace function public.get_next_checklist_seq()
returns text as $$
declare n bigint;
begin
  n := nextval('public.checklist_seq');
  -- Formato solicitado: CHECK-000001
  return 'CHECK-' || lpad(n::text, 6, '0');
end;
$$ language plpgsql;

-- Backfill: atribuir seq para registros existentes sem código
do $$ begin
  update public.checklists
  set seq = public.get_next_checklist_seq()
  where coalesce(seq, '') = '';
exception when others then null; end $$;

-- RPC for CNPJ (mock/cache)
create or replace function public.getCnpjData(p_cnpj text)
returns jsonb as $$
declare payload jsonb;
begin
  select data into payload from public.cnpj_cache where cnpj = p_cnpj;
  if payload is null then
    payload := jsonb_build_object(
      'cnpj', p_cnpj,
      'razaoSocial', 'Fornecedor Mock',
      'nomeFantasia', 'Fornecedor',
      'endereco', jsonb_build_object('logradouro', 'Rua Demo'),
      'telefone', '(00) 0000-0000',
      'email', 'demo@example.com'
    );
    insert into public.cnpj_cache(cnpj, data)
    values (p_cnpj, payload)
    on conflict (cnpj) do update set data = excluded.data, cached_at = now();
  end if;
  return payload;
end;
$$ language plpgsql;

-- Note: Configure RLS as needed. For development, you can leave RLS disabled.

-- Workflow columns
alter table public.checklists
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists maintenance_seconds bigint,
  add column if not exists is_locked boolean default false;

-- Finalize RPC
-- Garantir que não exista versão prévia com tipo diferente
drop function if exists public.finalize_checklist(uuid, uuid);
create or replace function public.finalize_checklist(chk_id uuid, user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare started timestamptz;
declare secs int;
begin
  -- Permissão: admin ou owner (se existir created_by)
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and (
      u.role = 'admin' or exists (select 1 from public.checklists c where c.id = chk_id and c.created_by = auth.uid())
    )
  ) then
    raise exception 'permission denied';
  end if;

  select c.started_at into started from public.checklists c where c.id = chk_id;
  secs := greatest(0, extract(epoch from (now() - coalesce(started, now())))::int);

  update public.checklists
  set finished_at = now(),
      status = 'finalizado',
      maintenance_seconds = secs,
      is_locked = true
  where id = chk_id;

  insert into public.checklist_audit(checklist_id, user_id, action, details)
  values (chk_id, auth.uid(), 'finalized', jsonb_build_object('maintenance_seconds', secs));

  return jsonb_build_object('success', true, 'maintenance_seconds', secs);
end;
$$;

-- Reopen RPC (admin only by policy)
-- Garantir que não exista versão prévia com tipo diferente
drop function if exists public.reopen_checklist(uuid, uuid);
create or replace function public.reopen_checklist(chk_id uuid, user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Apenas admin pode reabrir
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then
    raise exception 'permission denied';
  end if;

  update public.checklists
  set status = 'em_andamento',
      is_locked = false,
      finished_at = null,
      maintenance_seconds = null
  where id = chk_id;

  insert into public.checklist_audit(checklist_id, user_id, action, details)
  values (chk_id, auth.uid(), 'reopened', '{}'::jsonb);

  return jsonb_build_object('success', true);
end;
$$;

-- Set user role RPC (admin-only)
-- Garantir que não exista versão prévia com assinatura diferente
drop function if exists public.set_user_role(uuid, text);
create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then
    raise exception 'permission denied';
  end if;
  update public.users set role = new_role where id = target;
end;
$$;

-- Enable RLS on core tables
alter table if exists public.users enable row level security;
alter table if exists public.checklists enable row level security;
alter table if exists public.suppliers enable row level security;
alter table if exists public.vehicles enable row level security;

-- Users policies
do $$ begin
  begin
    create policy users_read_admin on public.users
    for select to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
  exception when duplicate_object then null; end;
  begin
    create policy users_read_self on public.users
    for select to authenticated using (id = auth.uid());
  exception when duplicate_object then null; end;
  begin
    -- Usuário pode atualizar apenas seu próprio registro; controle de mudança de role é feito por trigger abaixo
    create policy users_update_self on public.users
    for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
  exception when duplicate_object then null; end;
  begin
    create policy users_admin_update on public.users
    for update to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
  exception when duplicate_object then null; end;
  begin
    create policy users_admin_delete on public.users
    for delete to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
  exception when duplicate_object then null; end;
end $$;

-- Trigger: impedir alteração de role por não-admin
-- Remove versões anteriores e recria com checagem de permissão
drop trigger if exists trg_prevent_role_escalation on public.users;
drop function if exists public.prevent_role_escalation();
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- Se alguém tentar alterar role e não for admin, bloquear
    if new.role is distinct from old.role then
      if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') then
        raise exception 'permission denied to change role';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_escalation
before update on public.users
for each row execute function public.prevent_role_escalation();

-- Checklists policies
do $$ begin
  begin
    create policy checklists_read_any on public.checklists
    for select to authenticated using (true);
  exception when duplicate_object then null; end;
  begin
    create policy checklists_update_unlocked on public.checklists
    for update to authenticated using (is_locked = false) with check (is_locked = false);
  exception when duplicate_object then null; end;
  -- Recria a policy de delete para admin com checagem case-insensitive
  begin
    drop policy if exists checklists_delete_admin on public.checklists;
  exception when undefined_object then null; end;
  begin
    create policy checklists_delete_admin on public.checklists
    for delete to authenticated using (
      exists (
        select 1 from public.users u where u.id = auth.uid() and lower(coalesce(u.role, '')) = 'admin'
      )
    );
  exception when duplicate_object then null; end;
  -- Permitir que o proprietário exclua quando desbloqueado
  begin
    create policy checklists_delete_owner_unlocked on public.checklists
    for delete to authenticated using (created_by = auth.uid() and is_locked = false);
  exception when duplicate_object then null; end;
end $$;

-- Suppliers policies
do $$ begin
  begin
    create policy suppliers_read_any on public.suppliers for select to authenticated using (true);
  exception when duplicate_object then null; end;
  begin
    create policy suppliers_write_roles on public.suppliers
    for insert to authenticated with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','editor')));
  exception when duplicate_object then null; end;
  begin
    create policy suppliers_update_roles on public.suppliers
    for update to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','editor')));
  exception when duplicate_object then null; end;
  begin
    create policy suppliers_delete_admin on public.suppliers
    for delete to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
  exception when duplicate_object then null; end;
end $$;

-- Vehicles policies
do $$ begin
  begin
    create policy vehicles_read_any on public.vehicles for select to authenticated using (true);
  exception when duplicate_object then null; end;
  begin
    create policy vehicles_write_roles on public.vehicles
    for insert to authenticated with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','editor')));
  exception when duplicate_object then null; end;
  begin
    create policy vehicles_update_roles on public.vehicles
    for update to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','editor')));
  exception when duplicate_object then null; end;
  begin
    create policy vehicles_delete_admin on public.vehicles
    for delete to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
  exception when duplicate_object then null; end;
end $$;

-- Storage policies (bucket 'checklists')
-- Observação: em projetos hospedados no Supabase, a tabela storage.objects
-- é geralmente de propriedade de um papel interno (ex.: supabase_admin).
-- Executar ALTER TABLE ou CREATE POLICY pode exigir essa propriedade.
-- Para evitar erro 42501 (must be owner of table objects), use o painel:
-- Dashboard > Storage > Policies para criar as regras abaixo.
-- Ainda assim, tentamos aplicar com tratamento de exceção para ignorar
-- situações de privilégio insuficiente.
do $$ begin
  begin
    alter table storage.objects enable row level security;
  exception when insufficient_privilege then null;
          when undefined_object then null; end;
  begin
    create policy storage_insert_checklists on storage.objects
    for insert to authenticated with check (bucket_id = 'checklists');
  exception when insufficient_privilege then null;
          when duplicate_object then null; end;
  begin
    create policy storage_select_checklists on storage.objects
    for select to authenticated using (bucket_id = 'checklists');
  exception when insufficient_privilege then null;
          when duplicate_object then null; end;
  begin
    create policy storage_delete_admin on storage.objects
    for delete to authenticated using (
      bucket_id = 'checklists' and exists (
        select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
      )
    );
  exception when insufficient_privilege then null;
          when duplicate_object then null; end;
end $$;

-- Audit table
create table if not exists public.checklist_audit (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references public.checklists(id) on delete cascade,
  user_id uuid,
  action text,
  details jsonb,
  created_at timestamptz default now()
);

-- Garantir ON DELETE CASCADE no FK, caso a tabela já exista com restrição antiga
do $$ begin
  begin
    alter table if exists public.checklist_audit
      drop constraint if exists checklist_audit_checklist_id_fkey;
  exception when undefined_object then null; end;
  begin
    alter table if exists public.checklist_audit
      add constraint checklist_audit_checklist_id_fkey
      foreign key (checklist_id) references public.checklists(id) on delete cascade;
  exception when duplicate_object then null; end;
end $$;

-- Optional RLS policies (pseudo; adjust in SQL Editor as needed)
-- Example: allow edit when created_by = auth.uid() and status != 'finalizado'
-- and allow admins by role mapping (configure in auth and a view or using JWT)