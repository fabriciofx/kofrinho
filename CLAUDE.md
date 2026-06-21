# Kofrinho — CLAUDE.md

Cofre digital pessoal: o usuário cria **kofrinhos** (categorias de poupança) e cadastra **depósitos** recorrentes em cada um. Aplicação full-stack com React + Express + SQLite.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 |
| Backend | Express 4 + TypeScript + SQLite (sqlite3) |
| Testes E2E | Playwright (Chromium) |
| Testes unitários | Jest + Supertest (só no servidor) |
| Auth | JWT — access token (2h) + refresh token (7d) |
| Avatares | Multer + disco em `server/uploads/avatars/` |

---

## Como rodar

```bash
# Frontend (5173) + Backend (3000) juntos
npm run dev:full

# Individualmente
npm run dev           # só Vite
npm run dev:server    # cd server && npm run build && npm start

# Após qualquer mudança no servidor
cd server && npm run build && npm start

# Testes E2E (sobem os dois servidores automaticamente)
npm run test:e2e
npm run test:e2e:ui   # modo interativo
```

> **Atenção**: o servidor Express usa os arquivos compilados em `server/dist/`.
> Qualquer alteração no backend exige `npm run build` + restart.
> O processo já rodando em memória **não recarrega** ao salvar os `.ts`.

---

## Estrutura de arquivos

```
kofrinho/
├── src/                          # Frontend React
│   ├── api/client.ts             # Único ponto de acesso à API (fetch)
│   ├── context/
│   │   ├── AuthContext.tsx       # Estado: user, isAuthenticated, tokens
│   │   └── KofrinhoContext.tsx   # Estado: kofrinhos[], selectedKofrinho,
│   │                             #         depositos[], loading, error
│   ├── pages/
│   │   ├── Home.tsx              # Login/Registro/Dashboard (modo único por estado)
│   │   └── KofrinhoDetails.tsx   # Detalhes + edição + tabela de depósitos
│   │   # /solicitacoes/:id NÃO é página React — é HTML do backend
│   │   # (server/src/controllers/solicitacaoController.ts: paginaSolicitacao)
│   ├── components/
│   │   ├── Modal.tsx             # Modal genérico reutilizável
│   │   ├── KofrinhoForm.tsx      # Form criar kofrinho (usado em modal)
│   │   ├── DepositoForm.tsx      # Form criar depósito (nome, valor, recorrência)
│   │   └── AvatarUpload.tsx      # Upload/remoção de foto de perfil
│   └── styles/                   # CSS por componente (sem CSS-in-JS)
│       ├── Auth.css
│       ├── Dashboard.css
│       ├── KofrinhoDetails.css
│       ├── KofrinhoForm.css
│       ├── DepositoForm.css
│       ├── Modal.css
│       └── AvatarUpload.css
│
├── server/src/                   # Backend Express
│   ├── index.ts                  # App + CORS + rotas + catch-all 404 JSON
│   ├── database/
│   │   ├── db.ts                 # Helpers Promise: getAsync, allAsync,
│   │   │                         # runAsync, runAsyncWithLastId
│   │   └── init.ts               # CREATE TABLE IF NOT EXISTS (idempotente)
│   ├── controllers/
│   │   ├── authController.ts     # register, login, refresh, forgotPassword, resetPassword
│   │   ├── kofrinhoController.ts # CRUD completo de kofrinhos
│   │   ├── depositoController.ts # create, list, delete de depósitos
│   │   └── avatarController.ts   # upload, delete de avatares
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── kofrinhoRoutes.ts     # kofrinhos + depositos aninhados
│   │   └── avatarRoutes.ts
│   ├── middleware/auth.ts        # Verifica Bearer JWT → req.userId
│   ├── utils/
│   │   ├── jwt.ts                # sign/verify access e refresh tokens
│   │   ├── validation.ts
│   │   ├── passwordRecovery.ts
│   │   └── avatarUpload.ts
│   └── services/
│       ├── emailService.ts        # Envio de e-mail; ao notificar um depositante
│       │                          # também dispara a mesma mensagem por WhatsApp
│       └── whatsappService.ts     # Envio via WhatsApp Cloud API (Meta Graph)
│
├── e2e/                          # Testes Playwright
│   ├── fixtures.ts               # authenticatedPage: usuário único por teste
│   ├── 01-registration.spec.ts
│   ├── 02-login.spec.ts
│   ├── 03-kofrinho-crud.spec.ts  # ⚠️ QUEBRADO — seletores da UI antiga
│   ├── 04-avatar-upload.spec.ts
│   ├── 05-auth-persistence.spec.ts
│   ├── 06-kofrinho-details.spec.ts  # 1 cenário: carrega sem "Failed to fetch"
│   ├── 07-deposito.spec.ts          # 10 cenários: criar depósito
│   └── 08-deposito-delete.spec.ts   # 6 cenários: deletar depósito
│
├── playwright.config.ts          # webServer[] → inicia Vite + Express
├── vite.config.ts                # Sem proxy; API_BASE_URL é absoluta
└── server/kofrinho.sqlite        # Banco de dados (não commitado)
```

---

## Banco de dados (SQLite)

Arquivo: `server/kofrinho.sqlite`. Criado/migrado automaticamente em cada boot via `initializeDatabase()` com `CREATE TABLE IF NOT EXISTS`.

```sql
CREATE TABLE users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_completo        TEXT NOT NULL,
  email                TEXT UNIQUE NOT NULL,
  senha_hash           TEXT NOT NULL,
  foto_avatar          TEXT,                    -- path relativo ao servidor
  reset_token          TEXT,
  reset_token_expira_em DATETIME,
  criado_em            DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em        DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE kofrinhos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  descricao  TEXT,
  criado_em  DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE depositos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kofrinho_id  INTEGER NOT NULL REFERENCES kofrinhos(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  valor        REAL NOT NULL,
  recorrencia  TEXT NOT NULL CHECK(recorrencia IN ('anual','mensal','semanal','diario')),
  criado_em    DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- Índices
CREATE INDEX idx_kofrinhos_user_id   ON kofrinhos(user_id)
CREATE INDEX idx_users_email         ON users(email)
CREATE INDEX idx_depositos_kofrinho_id ON depositos(kofrinho_id)
```

---

## API REST

Base: `http://localhost:3000/api` (hardcoded em `src/api/client.ts`)  
Autenticação: `Authorization: Bearer <access_token>` em todas as rotas de kofrinhos e avatares.  
Todas as respostas são **JSON** — inclusive erros 404 (`{ erro: "Rota não encontrada" }`).

```
# Auth (sem token)
POST  /api/auth/register          { nome_completo, email, senha }
POST  /api/auth/login             { email, senha }
POST  /api/auth/refresh           { refreshToken }
POST  /api/auth/forgot-password   { email }
POST  /api/auth/reset-password    { token, novaSenha }

# Kofrinhos (requer token)
GET    /api/kofrinhos
POST   /api/kofrinhos             { nome, descricao? }
GET    /api/kofrinhos/:id
PUT    /api/kofrinhos/:id         { nome?, descricao? }
DELETE /api/kofrinhos/:id

# Depósitos (requer token; kofrinho deve pertencer ao usuário)
GET    /api/kofrinhos/:id/depositos
POST   /api/kofrinhos/:id/depositos    { nome, valor, recorrencia }
DELETE /api/kofrinhos/:id/depositos/:depositoId

# Avatares (requer token)
POST   /api/avatars/upload        multipart/form-data campo "avatar"
DELETE /api/avatars

# Solicitações
POST   /api/solicitacoes/:solicitacaoId   # Webhook Confrapix: confirma pagamento

GET    /api/health
```

### Página web pública da solicitação (HTML, servida pelo backend)

```
GET  /solicitacoes/:solicitacaoId            # Página HTML: QR Code (imagem) +
                                             # Pix copia-e-cola + botão copiar
GET  /solicitacoes/:solicitacaoId/qrcode.png # Imagem PNG do QR Code
```

- **Não é uma SPA nem uma chamada à API** — é HTML renderizado pelo Express,
  para abrir direto em `https://mandacaru.org/solicitacoes/:id`.
- O QR Code da Confrapix é salvo em disco como imagem em
  `uploads/qrcodes/<solicitacao_id>.png` (no agendamento e, como fallback, na
  rota da imagem) e exibido via `<img src=".../qrcode.png">`.
- A solicitação guarda `pix_url` (QR base64) e `pix_code` (copia-e-cola), gerados
  pelo Confrapix no agendamento — mesmo conteúdo do e-mail/WhatsApp.
- **Caddy** (ver `Caddyfile` na raiz): `mandacaru.org` deve fazer
  `handle /solicitacoes/* { reverse_proxy localhost:3000 }` **antes** do
  fallback SPA (`try_files {path} /index.html`), senão essa URL serve o
  `index.html` da SPA em vez da página do backend.

---

## Estado atual da UI

### Dashboard (`/`)
- **Sidebar**: nome, e-mail, avatar com botão "Alterar foto"
- **Main**: grid de cards de kofrinhos. Cada card tem:
  - Nome, descrição (opcional), data de criação
  - Botão `Ver Detalhes` → navega para `/kofrinho/:id`
  - Botão `Criar Depósito` (verde) → abre modal com `DepositoForm`
  - Botão `Deletar` (vermelho) → confirma e remove
- Botão `+ Criar novo Kofrinho` → abre modal com `KofrinhoForm`
- Estado vazio: "Você ainda não tem kofrinhos. Crie um novo!"

### Página de Detalhes (`/kofrinho/:id`)
- Card "Informações do Kofrinho": nome, descrição, data; botões Editar / Deletar
- Modo edição inline: campos nome e descrição + Salvar / Cancelar
- Seção "Depósitos": tabela com colunas **Nome | Valor | Recorrência | (lixeira)**
  - Valor formatado: `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
  - Recorrência: `diario→Diário | semanal→Semanal | mensal→Mensal | anual→Anual`
  - Lixeira 🗑: discreta (opacity 0.5), vermelha no hover; pede confirmação via `confirm()`
  - Estado vazio: "Nenhum depósito cadastrado ainda."

### Fluxo de auth
- `Home.tsx` é uma SPA com quatro modos: `'login' | 'register' | 'forgot' | 'dashboard'`
- `isAuthenticated` = `user !== null && tokens !== null`
- **Sem persistência entre refreshes**: `AuthContext` não restaura o `user` do localStorage ao recarregar — o usuário precisa fazer login novamente após fechar o browser

---

## Arquitetura do frontend

### Gerenciamento de estado (`KofrinhoContext`)

```
Estado global:
  kofrinhos[]        ← lista do dashboard (GET /kofrinhos)
  selectedKofrinho   ← kofrinho aberto na página de detalhes
  depositos[]        ← depósitos do selectedKofrinho
  loading            ← spinner / botões desabilitados
  error              ← string de erro (mostrada na tela)

Operações estáveis (useCallback com deps []):
  selectKofrinho(id)              → GET /kofrinhos/:id
  fetchDepositos(kofrinhoId)      → GET /kofrinhos/:id/depositos
  createDeposito(...)             → POST /kofrinhos/:id/depositos
  deleteDeposito(kofrinhoId, id)  → DELETE + remove otimisticamente do estado

Operações não-memoizadas (OK pois não estão em deps de useEffect):
  fetchKofrinhos, createKofrinho, updateKofrinho, deleteKofrinho
```

**Motivo do `useCallback`**: `selectKofrinho` e `fetchDepositos` estão no array de dependências de `useEffect` em `KofrinhoDetails`. Sem memo, cada re-render do provider gera nova referência → loop infinito de chamadas à API.

### `handleResponse` em `client.ts`

```ts
// Antes de parsear JSON, verifica Content-Type
// Sem isso: servidor HTML (ex: 404 Express padrão) → JSON.parse explode
// com erro bruto visível ao usuário: "Unexpected token '<', <!DOCTYPE..."
const contentType = response.headers.get('content-type') ?? ''
if (!contentType.includes('application/json')) {
  throw new Error(`Erro ${response.status}: resposta inesperada do servidor`)
}
```

### Modais

`Modal.tsx` faz `if (!isOpen) return null` — o elemento é **removido do DOM** quando fechado.  
Nos testes Playwright, usar `state: 'hidden'` (captura tanto ausência quanto invisibilidade).

---

## Arquitetura do backend

### Padrão de controllers

Cada controller tem helpers locais que suportam injeção de banco de teste via `req.testDb`:

```ts
function getDbAsync<T>(req, sql, params) {
  const db = req.testDb   // injetado pelos testes Jest
  if (db) { /* usa db de teste */ }
  return getAsync<T>(sql, params)  // usa banco real
}
```

### Middleware de auth

`router.use(authMiddleware)` cobre **todos** os paths do router, incluindo rotas não registradas.  
**Consequência**: uma rota inexistente responde 401 (sem token) em vez de 404.  
→ Não use ausência de 401 como prova de que a rota existe. Teste autenticado.

### Catch-all 404

```ts
// server/src/index.ts — depois de todas as rotas
app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' })
})
```

Sem isso, Express retorna `<!DOCTYPE html>...Cannot POST /...` para rotas inexistentes.

---

## Testes E2E

### Configuração (`playwright.config.ts`)

```ts
webServer: [
  { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  { command: 'npm run dev:server', url: 'http://localhost:3000/api/health',
    reuseExistingServer: true, timeout: 120000 }
]
```

`npm run dev:server` = `cd server && npm run build && npm start` — lento (compila antes), mas confiável.

### Fixture `authenticatedPage`

Cada teste recebe uma página já autenticada com um usuário único (`test${Date.now()}@example.com`). Senha padrão: `Test@1234`.

### Estado dos testes por arquivo

| Arquivo | Cenários | Status |
|---------|----------|--------|
| `01-registration.spec.ts` | Registro de usuário | Funciona |
| `02-login.spec.ts` | Login / logout | Funciona |
| `03-kofrinho-crud.spec.ts` | CRUD kofrinho | ⚠️ **Quebrado** — usa `text=Criar Novo Kofrinho` e form inline que não existem mais (UI migrou para modal) |
| `04-avatar-upload.spec.ts` | Upload de avatar | A verificar |
| `05-auth-persistence.spec.ts` | Persistência de sessão | A verificar |
| `06-kofrinho-details.spec.ts` | Página de detalhes carrega | Funciona |
| `07-deposito.spec.ts` | Criar depósito (10 cenários) | Funciona |
| `08-deposito-delete.spec.ts` | Deletar depósito (6 cenários) | Funciona |

---

## Tarefas pendentes

### Bugs conhecidos

- [ ] **`03-kofrinho-crud.spec.ts` quebrado**: todos os 7 testes falham porque referenciam `text=Criar Novo Kofrinho` (texto antigo) e `input[id="nome"]` direto na página (agora dentro de modal). Precisam ser reescritos para abrir o modal primeiro.
- [ ] **Sessão não persiste no refresh**: `AuthContext` tem `useEffect` vazio que lê o token do localStorage mas não reconstrói o estado `user`. O usuário é deslogado ao recarregar a página. Fix: chamar `GET /api/auth/me` (endpoint inexistente) ou decodificar o JWT localmente para restaurar `user`.

### Funcionalidades não implementadas

- [ ] **Editar depósito**: só existe criar e deletar. Falta botão "Editar" na linha da tabela e endpoint `PUT /api/kofrinhos/:id/depositos/:depositoId`.
- [ ] **Criar depósito da página de detalhes**: o botão "Criar Depósito" existe apenas no card do dashboard. A página de detalhes só lista e remove.
- [ ] **Total dos depósitos por kofrinho**: nenhuma agregação de valor é mostrada (ex: total mensal, anual projetado).
- [ ] **Paginação**: sem limite/offset no `GET /kofrinhos` ou `GET /depositos`.
- [ ] **Ordenação da tabela de depósitos**: fixo em `ORDER BY criado_em DESC`.
- [ ] **Endpoint `/api/auth/me`**: sem rota para validar/restaurar sessão após refresh de página.
- [ ] **Testes unitários do servidor**: `server/src/__tests__/` existe (Jest + Supertest) mas não foram verificados nesta sessão.

### Melhorias técnicas

- [ ] **Proxy Vite**: `API_BASE_URL` está hardcoded como `http://localhost:3000/api`. Configurar proxy no `vite.config.ts` permitiria usar URLs relativas e eliminar o CORS completamente em dev.
- [ ] **`fetchKofrinhos` e outros sem `useCallback`**: OK por agora pois não estão em deps de `useEffect`, mas `useCallback` evitaria re-renders desnecessários nos filhos.
- [ ] **Variáveis de ambiente**: porta do servidor e `API_BASE_URL` hardcoded. Deveriam vir de `.env`.
- [ ] **`server/kofrinho.sqlite` não está no `.gitignore`**: o banco de dados está sendo commitado (ou ignorado por regra implícita — verificar).

---

## Histórico de commits desta sessão

```
7138703  Docs: adiciona CLAUDE.md com recap do projeto
957ed13  Fix: corrige rota DELETE depósito e adiciona testes E2E
9709248  Feat: adiciona ícone de lixeira para remover depósitos da tabela
defe9b0  Fix: corrige erro 'Unexpected token <' ao criar depósito
498f48b  Test: adiciona testes E2E para a feature Criar Depósito
7e72e7d  Feat: adiciona criação e listagem de depósitos por Kofrinho
d58efca  Fix: resolve kofrinho details 'Failed to fetch' error e card overlapping
```

Commits anteriores à sessão (herança): `cf4917f` ← `b548007` ← `b3fcaa7` ← ... ← `c23d694` (first commit).

---

## Armadilhas documentadas

| Situação | Sintoma | Causa | Como evitar |
|----------|---------|-------|-------------|
| Mudança no backend sem rebuild | Rota retorna 404 ou comportamento antigo | `node dist/index.js` carrega arquivos em memória na startup | Sempre `npm run build` + restart |
| Testar se rota existe via curl sem token | Recebe 401 e acha que a rota existe | `router.use(authMiddleware)` intercepta antes de checar a rota | Testar sempre com token válido |
| Adicionar função de contexto em `useEffect` deps | Loop infinito de chamadas à API | Função recriada a cada render → useEffect re-dispara | Usar `useCallback` com deps `[]` para funções estáveis |
| Servidor Express sem catch-all | Erro bruto HTML vaza para o usuário | Express 404 padrão retorna `<!DOCTYPE html>` | Manter o `app.use((_req, res) => res.status(404).json(...))` |
| `handleResponse` sem checagem de Content-Type | `JSON.parse` explode com mensagem técnica | Servidor retorna HTML em vez de JSON | Verificar `Content-Type: application/json` antes de parsear |
