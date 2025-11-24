-- Resetar sequência de checklists para iniciar em 000001
-- Rode este script no SQL Editor do Supabase (Primary DB)

begin;

-- Garantir que a sequência exista
create sequence if not exists public.checklist_seq start 1;

-- Reiniciar contador para que o próximo seja 1 (gera CHECK-000001)
alter sequence public.checklist_seq restart with 1;

-- Alternativa para Postgres antigos: força próximo valor como 1
select setval('public.checklist_seq', 0, false);

-- Se houver registros sem seq, preencher com novos códigos
update public.checklists
set seq = public.get_next_checklist_seq()
where coalesce(seq, '') = '';

commit;

-- Observações:
-- - Se você apagou todos os checklists, apenas o restart já é suficiente.
-- - Novos rascunhos criados pelo Wizard usarão o próximo código disponível.