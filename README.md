# CheckMaster (SPA mobile-first) — Supabase

Aplicação web responsiva construída com React + TypeScript + Vite, Tailwind CSS, PWA e Supabase (Auth, Postgres, Storage). Migrada de Firebase para Supabase.

## Stack
- React 18 + TypeScript + Vite
- Tailwind (mobile-first, dark/light)
- React Router
- Zustand (estado simples)
- Supabase Web SDK (Auth, Postgres, Storage)
- Libs: date-fns, react-hook-form, zod, browser-image-compression

## Setup
1. Crie um projeto no Supabase e habilite Auth e Storage.
2. Copie `.env.example` para `.env` e preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. No painel Supabase → Storage: crie o bucket privado `checklists`.
4. Instale dependências e rode o projeto:
   - `npm install`
   - `npm run dev`

## Deploy (GitHub Pages)

Este projeto está configurado para deploy automático no GitHub Pages via GitHub Actions.

### Passos

1. Configure os secrets do repositório (Settings → Secrets and variables → Actions):
   - `VITE_SUPABASE_URL` — URL do Supabase.
   - `VITE_SUPABASE_ANON_KEY` — chave anon pública do Supabase.

2. (Opcional) Se usar domínio próprio (sem `/CheckMaster/` no caminho), defina `VITE_BASE_PATH` como `/` nos Secrets e ajuste DNS.

3. No Supabase (Auth → Settings):
   - `Site URL` deve incluir a URL do GitHub Pages, por exemplo: `https://<seu-usuario>.github.io/CheckMaster/`.
   - `Additional Redirect URLs` deve incluir a mesma URL para fluxos de reset/magic link.

4. Push na branch `main` dispara o workflow `.github/workflows/deploy.yml` que:
   - Instala dependências
   - Compila com `npm run build`
   - Publica `dist/` no GitHub Pages, incluindo fallback `404.html` para SPA

### Acesso

Após o primeiro deploy, o site ficará disponível em:

`https://<seu-usuario>.github.io/CheckMaster/`

Para domínio próprio, defina `VITE_BASE_PATH=/` e atualize as configurações do Pages.

## Reset do projeto (zerar banco, usuários e storage)
- Aviso: operação destrutiva. Faça backup antes.

1) Banco (schema `public`)
- No Supabase SQL Editor, rode `supabase/migrations/reset.sql`.
- Em seguida, rode `supabase/migrations/init.sql` e `supabase/migrations/security.sql` para reconstruir o schema e políticas.

2) Auth (apagar todos os usuários)
- Requer a service role key. No PowerShell:
  - `$env:SUPABASE_URL="https://SEU-PROJECT.supabase.co"`
  - `$env:SUPABASE_SERVICE_ROLE_KEY="chave-service-role"`
  - `npm run reset:auth`

3) Storage (bucket `checklists`)
- Com as mesmas variáveis de ambiente do passo 2:
  - `npm run reset:storage`
  - Opcional: defina outro bucket com `$env:STORAGE_BUCKET="nome"`

4) Reconfiguração
- Preencha `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Faça login, promova um usuário a admin (via SQL, se necessário),
  e valide o app (menu Admin, rotas e uploads).

> Dica: use a página DevSeeds para criar dados de exemplo.

## SQL (Supabase)
Execute no SQL Editor:

```
create table users(id uuid primary key default gen_random_uuid(), email text, display_name text, created_at timestamptz default now());
create table vehicles(id uuid primary key default gen_random_uuid(), plate text unique, model text, brand text, year int, photo text);
create table suppliers(id uuid primary key default gen_random_uuid(), cnpj text, nome text, telefone text, email text, created_at timestamptz default now());
create table check_items(id uuid primary key default gen_random_uuid(), name text, order_n int default 0);
create sequence checklist_seq start 1;
create table checklists(
  id uuid primary key default gen_random_uuid(),
  seq text, seq_num bigint,
  plate text, supplier_id uuid references suppliers(id),
  defect_items jsonb, media jsonb, status text default 'rascunho',
  created_by uuid references users(id), created_at timestamptz default now());
create table cnpj_cache(cnpj text primary key, data jsonb, cached_at timestamptz default now());
```

Função de sequência:

```
create or replace function get_next_checklist_seq()
returns text as $$
declare n bigint;
begin
  n:=nextval('checklist_seq');
  return 'CHECK-'||lpad(n::text,6,'0');
end;
$$ language plpgsql;
```

RPC CNPJ: `getCnpjData(cnpj)` busca/insere mock em `cnpj_cache` e retorna JSON.

## Regras
RLS pode ser desativado em desenvolvimento para facilitar testes.

## Seeds
Página `#/dev/seeds` cria:
- `check_items`: Freio, Pneu
- `vehicles`: 1 veículo
- `suppliers`: 1 fornecedor

## Rotas
- `/` Login/Cadastro
- `/home` Dashboard
- `/checklists` Lista c/ filtros
- `/checklists/new` & `/checklists/:id` Wizard (4 etapas)
- `/vehicles` CRUD
- `/suppliers` CRUD + CNPJ
- `/settings` Perfil, tema, RBAC

## PWA
- `vite-plugin-pwa` com `registerType: autoUpdate`.
- Offline básico e instalação.

## Testes
- `vitest`: validadores de CNPJ e placa Mercosul (`src/tests/validators.test.ts`).

## Observações
- Upload com progresso (Storage Supabase) com URLs assinadas.
- Layout mobile-first, bottom nav, acessibilidade básica.
- Erros tratados com mensagens simples; refine conforme necessidade.

## PDF (mock)
Geração de PDF mock é feita no client com `Blob` durante dev, sem backend.