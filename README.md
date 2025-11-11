# CheckMaster (SPA mobile-first)

Aplicação web responsiva construída com React + TypeScript + Vite, Tailwind CSS, PWA e Firebase (Auth, Firestore, Storage, Cloud Functions).

## Stack
- React 18 + TypeScript + Vite
- Tailwind (mobile-first, dark/light)
- React Router
- Zustand (estado simples)
- Firebase Web SDK modular (Auth, Firestore, Storage)
- Cloud Functions (Node 18)
- Libs: date-fns, react-hook-form, zod, browser-image-compression

## Setup
1. Crie um projeto no Firebase e habilite Auth (e-mail/senha e Google), Firestore, Storage.
2. Copie `.env.example` para `.env` e preencha as variáveis:
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`
   - Opcional: `VITE_RECAPTCHA_V3_KEY` para App Check.
3. Instale dependências e rode o projeto:
   - `npm install`
   - `npm run dev`

## Cloud Functions
Em `functions/`:
- `getNextChecklistSeq` (callable): transação em `counters/checklist`, gera seq `CHK-000001` e atualiza o doc.
- `cnpjLookup` (callable): valida CNPJ, cache em `cnpj_cache/{cnpj}` e retorna dados (mock).
- `generateChecklistPdf` (callable): gera PDF simples, salva em Storage e retorna URL assinado.

Build/deploy:
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

## Regras
Aplicadas via `firebase.json`:
- Firestore: ver `firestore.rules`
- Storage: ver `storage.rules`

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
- Firestore com cache offline habilitado.
- Upload com progresso (Storage).
- Layout mobile-first, bottom nav, acessibilidade básica.
- Erros tratados com mensagens simples; refine conforme necessidade.