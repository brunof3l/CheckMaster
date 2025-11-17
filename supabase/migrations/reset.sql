-- Reset completo do banco (schema 'public') e metadados de storage
-- ATENÇÃO: Opera em produção com cuidado. Irreversível.

BEGIN;

-- Remove todo o conteúdo do schema público
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Privilégios mínimos para roles do Supabase
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

-- Limpeza de metadados do Storage
-- Observação: arquivos físicos são removidos via API.
DELETE FROM storage.objects;
DELETE FROM storage.buckets WHERE id = 'checklists';

-- (Opcional) recria bucket usado pela aplicação
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklists', 'checklists', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Após rodar este script:
-- 1) Execute supabase/migrations/init.sql
-- 2) Execute supabase/migrations/security.sql
-- 3) Rode os scripts de reset de Auth e Storage (ver README)