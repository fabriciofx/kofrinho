# Kofrinho — CLAUDE.md

Cofre digital pessoal para registrar kofrinhos (categorias de poupança) e depósitos recorrentes.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Express + TypeScript + SQLite (sqlite3) |
| Testes | Playwright (E2E) + Jest (unit/integration — servidor) |
| Auth | JWT (access token + refresh token) |

---

## Como rodar

```bash
# Frontend + Backend juntos (recomendado)
npm run dev:full

# Separado
npm run dev          # Vite na porta 5173
npm run dev:server   # Express na porta 3000 (build + start)

# Testes E2E (requer ambos os servidores)
npm run test:e2e
```

> **Importante**: sempre reiniciar o servidor após mudanças no backend:
> `cd server && npm run build && npm start`

---

## Estrutura

```
kofrinho/
├── src/                        # Frontend React
│   ├── api/client.ts           # Todas as chamadas fetch (API_BASE_URL = localhost:3000)
│   ├── context/
│   │   ├── AuthContext.tsx     # Usuário autenticado, tokens
│   │   └── KofrinhoContext.tsx # Kofrinhos + Depósitos (estado global)
│   ├── pages/
│   │   ├── Home.tsx            # Dashboard + modais de criar kofrinho/depósito
│   │   └── KofrinhoDetails.tsx # Detalhes + tabela de depósitos + lixeira
│   ├── components/
│   │   ├── Modal.tsx           # Modal genérico (remove do DOM quando fechado)
│   │   ├── KofrinhoForm.tsx    # Formulário criar kofrinho
│   │   ├── DepositoForm.tsx    # Formulário criar depósito
│   │   └── AvatarUpload.tsx
│   └── styles/                 # CSS por componente/página
│
├── server/src/                 # Backend Express
│   ├── index.ts                # App principal; inclui catch-all JSON 404
│   ├── database/
│   │   ├── db.ts               # Helpers: getAsync, allAsync, runAsync, runAsyncWithLastId
│   │   └── init.ts             # CREATE TABLE IF NOT EXISTS (users, kofrinhos, depositos)
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── kofrinhoController.ts
│   │   ├── depositoController.ts
│   │   └── avatarController.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── kofrinhoRoutes.ts   # inclui rotas de depósitos
│   │   └── avatarRoutes.ts
│   └── middleware/auth.ts      # Verifica Bearer JWT; retorna 401 JSON
│
└── e2e/                        # Testes Playwright
    ├── fixtures.ts             # authenticatedPage: registra usuário único por teste
    ├── 01-registration.spec.ts
    ├── 02-login.spec.ts
    ├── 03-kofrinho-crud.spec.ts
    ├── 04-avatar-upload.spec.ts
    ├── 05-auth-persistence.spec.ts
    ├── 06-kofrinho-details.spec.ts  # Verifica "Failed to fetch" corrigido
    ├── 07-deposito.spec.ts          # Criar depósito (10 cenários)
    └── 08-deposito-delete.spec.ts   # Deletar depósito (6 cenários)
```

---

## Banco de dados

SQLite em `server/kofrinho.sqlite`. Tabelas criadas via `initializeDatabase()` com `IF NOT EXISTS` — idempotente a cada reinício.

```sql
users        (id, nome_completo, email, senha_hash, foto_avatar, reset_token, ...)
kofrinhos    (id, user_id FK, nome, descricao, criado_em)
depositos    (id, kofrinho_id FK CASCADE, nome, valor REAL, recorrencia CHECK, criado_em)
```

`recorrencia` aceita apenas: `'anual' | 'mensal' | 'semanal' | 'diario'`

---

## Rotas da API

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password

GET    /api/kofrinhos
POST   /api/kofrinhos
GET    /api/kofrinhos/:id
PUT    /api/kofrinhos/:id
DELETE /api/kofrinhos/:id

POST   /api/kofrinhos/:id/depositos
GET    /api/kofrinhos/:id/depositos
DELETE /api/kofrinhos/:id/depositos/:depositoId

POST   /api/avatars/upload
DELETE /api/avatars
GET    /api/health
```

Todas as rotas de kofrinhos e depósitos requerem `Authorization: Bearer <token>`.  
O servidor sempre responde JSON — inclusive erros 404 (`{ erro: "Rota não encontrada" }`).

---

## Decisões e padrões

### Frontend
- `handleResponse` em `client.ts` verifica `Content-Type: application/json` antes de parsear — evita expor erros brutos de JSON.parse ao usuário quando o servidor retorna HTML.
- `selectKofrinho` e outras funções do contexto usam `useCallback` com deps `[]` para evitar loop infinito no `useEffect` de `KofrinhoDetails` (função nova referência a cada render → efeito re-disparava infinitamente).
- Modais removem-se do DOM quando fechados (`if (!isOpen) return null`) — usar `state: 'hidden'` nos testes Playwright.
- Depósitos são removidos otimisticamente do estado local (`setDepositos(prev => prev.filter(...))`) sem re-fetch.

### Backend
- `authMiddleware` com `router.use()` intercepta **qualquer** path do router, inclusive rotas inexistentes → retorna 401 mesmo para paths que não existem. Não usar isso como sinal de que a rota existe.
- Padrão de helpers `getDbAsync / allDbAsync / runDbAsync` em cada controller para suportar injeção de banco de teste (`req.testDb`) nos testes de integração Jest.
- O `dist/` é gerado pelo TypeScript e precisa ser **rebuilded** (`npm run build`) antes de reiniciar o servidor quando há mudanças.

### Testes E2E
- `playwright.config.ts` inicia os dois servidores (`webServer` array): Vite (5173) e Express (3000 via `npm run dev:server`).
- Cada teste usa `authenticatedPage` fixture que registra um usuário único com timestamp para isolamento.
- Os testes dos arquivos `03-kofrinho-crud.spec.ts` usam seletores da UI antiga (antes do modal) e podem falhar — não foram atualizados.

---

## Bugs resolvidos nesta sessão

| Commit | Problema | Causa | Fix |
|--------|----------|-------|-----|
| `d58efca` | Cards sobrepostos no dashboard | `margin: 0.75rem` nos itens do grid CSS + `gap` triplicado | Removido margin; gap unificado em `1.5rem` |
| `d58efca` | "Failed to fetch" ao abrir detalhes (testes) | `playwright.config.ts` não iniciava o backend | Adicionado segundo `webServer` para porta 3000 |
| `d58efca` | Loop infinito de chamadas à API em detalhes | `selectKofrinho` sem `useCallback` → nova ref a cada render | Envolvido em `useCallback([], [])` |
| `defe9b0` | "Unexpected token '<'" ao criar depósito | `handleResponse` parseava JSON sem checar Content-Type; Express retornava HTML para rotas 404 | Checar Content-Type; catch-all 404 JSON no servidor |
| `957ed13` | "Rota não encontrada" ao deletar depósito | Servidor rodando com build anterior à rota DELETE | Rebuild + restart; limpeza do `import()` dinâmico |
