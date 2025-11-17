-- CheckMaster: RPCs, RLS policies e trigger
-- Execute este script no SQL Editor do Supabase (Primary Database)
-- Observação: Storage policies devem ser criadas pelo Dashboard para evitar erro 42501.

-- 1) RPCs (dropar versões antigas para evitar conflito de tipos)
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
  -- Permissão: admin OU proprietário do checklist
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and (
      u.role = 'admin' or exists (
        select 1 from public.checklists c where c.id = chk_id and c.created_by = auth.uid()
      )
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

  -- Auditoria (tabela deve existir)
  insert into public.checklist_audit(checklist_id, user_id, action, details)
  values (chk_id, auth.uid(), 'finalized', jsonb_build_object('maintenance_seconds', secs));

  return jsonb_build_object('success', true, 'maintenance_seconds', secs);
end;
$$;

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

  -- Auditoria
  insert into public.checklist_audit(checklist_id, user_id, action, details)
  values (chk_id, auth.uid(), 'reopened', '{}'::jsonb);

  return jsonb_build_object('success', true);
end;
$$;

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

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u where u.id = uid and u.role = 'admin'
  );
$$;

-- 2) Habilitar RLS
alter table if exists public.users enable row level security;
alter table if exists public.checklists enable row level security;
alter table if exists public.suppliers enable row level security;
alter table if exists public.vehicles enable row level security;

-- 2.1) Grants: garantir privilégios básicos para o papel 'authenticated'
do $$ begin
  grant usage on schema public to authenticated;
  grant select, update, delete on table public.users to authenticated;
  grant select on table public.checklists, public.suppliers, public.vehicles to authenticated;
exception when others then null; end $$;

-- 3) Policies (com tolerância a duplicate_object)
do $$ begin
  -- users
  begin
    drop policy if exists users_read_admin on public.users;
    create policy users_read_admin on public.users
    for select to authenticated using (
      public.is_admin(auth.uid())
    );
  exception when duplicate_object then null; end;

  begin
    create policy users_read_self on public.users
    for select to authenticated using (id = auth.uid());
  exception when duplicate_object then null; end;

  begin
    -- Usuário pode atualizar apenas seu próprio registro; mudança de role é bloqueada por trigger
    create policy users_update_self on public.users
    for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
  exception when duplicate_object then null; end;

  begin
    drop policy if exists users_admin_update on public.users;
    create policy users_admin_update on public.users
    for update to authenticated using (
      public.is_admin(auth.uid())
    );
  exception when duplicate_object then null; end;

  begin
    drop policy if exists users_admin_delete on public.users;
    create policy users_admin_delete on public.users
    for delete to authenticated using (
      public.is_admin(auth.uid())
    );
  exception when duplicate_object then null; end;

  -- checklists
  begin
    create policy checklists_read_any on public.checklists
    for select to authenticated using (true);
  exception when duplicate_object then null; end;

  begin
    create policy checklists_update_unlocked on public.checklists
    for update to authenticated using (is_locked = false) with check (is_locked = false);
  exception when duplicate_object then null; end;

  begin
    create policy checklists_delete_admin on public.checklists
    for delete to authenticated using (
      exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
    );
  exception when duplicate_object then null; end;

  -- suppliers
  begin
    create policy suppliers_read_any on public.suppliers
    for select to authenticated using (true);
  exception when duplicate_object then null; end;

  begin
    create policy suppliers_write_roles on public.suppliers
    for insert to authenticated with check (
      exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','editor'))
    );
  exception when duplicate_object then null; end;

  begin
    create policy suppliers_update_roles on public.suppliers
    for update to authenticated using (
      exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','editor'))
    );
  exception when duplicate_object then null; end;

  begin
    create policy suppliers_delete_admin on public.suppliers
    for delete to authenticated using (
      exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
    );
  exception when duplicate_object then null; end;

  -- vehicles
  begin
    create policy vehicles_read_any on public.vehicles
    for select to authenticated using (true);
  exception when duplicate_object then null; end;

  begin
    create policy vehicles_write_roles on public.vehicles
    for insert to authenticated with check (
      exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','editor'))
    );
  exception when duplicate_object then null; end;

  begin
    create policy vehicles_update_roles on public.vehicles
    for update to authenticated using (
      exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin','editor'))
    );
  exception when duplicate_object then null; end;

  begin
    create policy vehicles_delete_admin on public.vehicles
    for delete to authenticated using (
      exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
    );
  exception when duplicate_object then null; end;
end $$;

-- 4) Trigger para bloquear escalonamento de role por não-admin
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

-- 5) (Opcional) Auditoria: garantir tabela (evita erro em RPC)
create table if not exists public.checklist_audit (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references public.checklists(id),
  user_id uuid,
  action text,
  details jsonb,
  created_at timestamptz default now()
);

-- 6) Validações rápidas
-- Funções: tipos de retorno esperados (jsonb, jsonb, void)
select proname, prorettype::regtype
from pg_proc
where proname in ('finalize_checklist','reopen_checklist','set_user_role');

-- Policies criadas
select schemaname, tablename, policyname
from pg_policies
where schemaname='public'
  and tablename in ('users','checklists','suppliers','vehicles')
order by tablename, policyname;

-- Storage: criar via Dashboard
-- Dashboard > Storage > Policies
-- 1) INSERT (authenticated): Using/With Check: bucket_id = 'checklists'
-- 2) SELECT (authenticated): Using: bucket_id = 'checklists'
-- 3) DELETE (authenticated): Using: bucket_id = 'checklists' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')