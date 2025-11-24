-- Tornar RPC de sequência acessível para usuários autenticados
-- e garantir privilégio sobre a sequence.

begin;

-- Conceder USAGE/SELECT na sequence ao papel 'authenticated'
do $$ begin
  begin
    grant usage, select on sequence public.checklist_seq to authenticated;
  exception when others then null; end;
end $$;

-- Recriar função como security definer para usar privilégios do owner
drop function if exists public.get_next_checklist_seq();
create or replace function public.get_next_checklist_seq()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  n := nextval('public.checklist_seq');
  return 'CHECK-' || lpad(n::text, 6, '0');
end;
$$;

commit;

-- Observação: caso o erro fosse de RLS nas tabelas, esta mudança não afeta policies.