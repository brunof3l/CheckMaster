-- Pool de reutilização de números de checklist e função de liberação

begin;

-- Tabela para armazenar números liberados para reutilização
create table if not exists public.checklist_seq_pool (
  val integer primary key
);

-- Função para liberar um código de checklist removido
create or replace function public.release_checklist_seq(p_seq text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v integer;
begin
  if p_seq is null or p_seq = '' then return; end if;
  begin
    v := regexp_replace(p_seq, '[^0-9]', '', 'g')::int;
  exception when others then
    -- Se não conseguir extrair número, não faz nada
    return;
  end;
  if v is null or v <= 0 then return; end if;

  -- Se ainda existir checklist com este código, não liberar
  if exists (select 1 from public.checklists where seq = p_seq) then
    return;
  end if;

  -- Inserir no pool para reutilização futura
  insert into public.checklist_seq_pool(val) values (v)
    on conflict (val) do nothing;
end;
$$;

commit;

-- Observações:
-- - A função usa security definer para evitar problemas de RLS.
-- - Os usuários autenticados não precisam de privilégios diretos na tabela; chamam a RPC.