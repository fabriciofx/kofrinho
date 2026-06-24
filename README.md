# Kofrinho 🐷

Cofre digital pessoal: o dono cria **kofrinhos** (categorias de poupança) e cadastra **depositantes** recorrentes em cada um. O sistema envia automaticamente um e-mail e/ou WhatsApp ao depositante com o QR Code Pix no intervalo configurado (diário, semanal, mensal ou anual). Quando o pagamento é confirmado pela Confrapix via webhook, o dono é notificado em tempo real no dashboard via SSE.

Produção: **https://mandacaru.org** | API: **https://api.mandacaru.org**

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite 8 + React Router 7 |
| Backend | Express 4 + TypeScript + SQLite (sqlite3) |
| Auth | JWT — access token (2h) + refresh token (7d) |
| Hash de senhas | Argon2id — memory 64 MiB, time cost 3, parallelism 4 |
| Pagamentos | Confrapix (gateway Pix) |
| E-mail agendamento | Resend |
| E-mail recuperação de senha | Nodemailer (SMTP) |
| WhatsApp | Meta Cloud API (WhatsApp Business) |
| Avatares | Multer + disco em `server/uploads/avatars/` |
| Testes E2E | Playwright (Chromium) |
| Testes unitários | Jest + Supertest (backend) |

---

## Como rodar

```bash
# Instala dependências (raiz e servidor)
npm install
cd server && npm install && cd ..

# Frontend (5173) + Backend (3000) juntos
npm run dev:full

# Individualmente
npm run dev           # só Vite (frontend)
npm run dev:server    # compila e sobe o Express

# Após qualquer mudança no servidor
cd server && npm run build && npm start

# Testes E2E (sobem os dois servidores automaticamente)
npm run test:e2e
npm run test:e2e:ui   # modo interativo Playwright

# Testes unitários do backend
cd server && npm test
```

> **Importante**: o Express usa arquivos compilados em `server/dist/`.
> Toda mudança no backend exige `npm run build` + restart.
> O processo em memória **não recarrega** ao salvar `.ts`.

---

## Variáveis de ambiente

Crie `server/.env` (o arquivo nunca deve ser commitado):

```env
# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_REFRESH_SECRET=outra_chave_secreta_aqui

# CORS — domínios separados por vírgula (dev aceita localhost por padrão)
CORS_ORIGIN=https://mandacaru.org

# URL pública do backend (usada na callback_url enviada à Confrapix)
KOFRINHO_API_URL=https://api.mandacaru.org

# URL pública do frontend (usada no link do WhatsApp de agendamento)
FRONTEND_URL=https://mandacaru.org

# Pagamentos Pix
CONFRAPIX_TOKEN=seu_token_confrapix

# E-mail de agendamento (Resend) — envio real só com NODE_ENV=production
RESEND_TOKEN=re_xxxxxxxxxxxxx
EMAIL_FROM=Kofrinho <noreply@mandacaru.org>

# E-mail recuperação de senha (SMTP) — opcional: sem SMTP_HOST usa Ethereal em dev
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario@exemplo.com
SMTP_PASS=sua_senha_smtp

# WhatsApp Cloud API (Meta) — envio real só com NODE_ENV=production
WHATSAPP_TOKEN=seu_token_meta
WHATSAPP_PHONE_NUMBER_ID=id_do_numero
WHATSAPP_API_VERSION=v21.0   # opcional, default v21.0

# Comportamento em execução
NODE_ENV=production           # habilita envio de e-mail e WhatsApp
SCHEDULER_DISABLED=true       # desliga o agendador (útil nos testes E2E)
TEST_ROUTES=true              # habilita /test/* (nunca em produção)
```

Para o frontend, crie `.env.local` na raiz do projeto:

```env
VITE_API_URL=https://api.mandacaru.org/api
```

Sem essa variável, o cliente usa `http://localhost:3000/api`.

---

## Estrutura de arquivos

```
kofrinho/
├── src/                          # Frontend React
│   ├── api/client.ts             # Único ponto de acesso à API
│   ├── context/
│   │   ├── AuthContext.tsx       # Estado: user, isAuthenticated, tokens
│   │   └── KofrinhoContext.tsx   # Estado: kofrinhos[], depositantes[], solicitacoes[]
│   ├── pages/
│   │   ├── Home.tsx              # Login / Registro / Dashboard (modo único por estado)
│   │   ├── KofrinhoDetails.tsx   # Detalhes + depositantes + solicitações
│   │   └── LandingPage.tsx       # Página pública de apresentação
│   ├── components/
│   │   ├── Modal.tsx             # Modal genérico
│   │   ├── KofrinhoForm.tsx      # Form criar kofrinho
│   │   ├── DepositanteForm.tsx   # Form criar depositante
│   │   ├── EditDepositanteForm.tsx
│   │   ├── EditKofrinhoForm.tsx
│   │   ├── AvatarUpload.tsx      # Upload/remoção de foto de perfil
│   │   ├── Calendar.tsx          # Calendário para DatePicker
│   │   └── DatePicker.tsx        # Seletor de data (data de início)
│   └── styles/                   # CSS por componente (sem CSS-in-JS)
│
├── server/src/                   # Backend Express
│   ├── index.ts                  # App + CORS + rotas + variáveis de ambiente
│   ├── database/
│   │   ├── db.ts                 # Helpers Promise: getAsync, allAsync, runAsync
│   │   └── init.ts               # CREATE TABLE IF NOT EXISTS (idempotente + migrations)
│   ├── controllers/
│   │   ├── authController.ts     # register, login, refresh, forgotPassword, resetPassword
│   │   ├── kofrinhoController.ts # CRUD completo de kofrinhos (com saldo calculado)
│   │   ├── depositanteController.ts # CRUD depositantes + criação de agendamento
│   │   ├── avatarController.ts   # upload, delete avatares
│   │   └── solicitacaoController.ts # webhook confirmação, página HTML, SSE
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   ├── kofrinhoRoutes.ts     # kofrinhos + depositantes + solicitações aninhados
│   │   └── avatarRoutes.ts
│   ├── middleware/auth.ts        # Verifica Bearer JWT → req.userId
│   ├── services/
│   │   ├── confrapixService.ts   # Geração de Pix via API Confrapix
│   │   ├── schedulerService.ts   # Agendador de envios (polling 1s)
│   │   ├── emailService.ts       # Resend (agendamento) + Nodemailer (recuperação)
│   │   └── whatsappService.ts    # Meta Cloud API
│   └── utils/
│       ├── jwt.ts                # sign/verify tokens
│       ├── validation.ts         # e-mail e senha
│       ├── passwordRecovery.ts   # geração/validação de token de reset
│       ├── avatarUpload.ts       # Multer config
│       └── qrcodeStorage.ts      # Salva QR Code como PNG em disco
│
├── e2e/                          # Testes Playwright
├── playwright.config.ts
├── vite.config.ts
├── Caddyfile                     # Referência de configuração para produção
└── server/kofrinho.sqlite        # Banco de dados (não commitado)
```

---

## Banco de dados (SQLite)

Arquivo: `server/kofrinho.sqlite`. Criado/migrado automaticamente no boot via `initializeDatabase()`.

```sql
CREATE TABLE users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_completo         TEXT NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  senha_hash            TEXT NOT NULL,           -- Argon2id (64 MiB, t=3, p=4)
  foto_avatar           TEXT,           -- path relativo em uploads/avatars/
  reset_token           TEXT,
  reset_token_expira_em DATETIME,
  criado_em             DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em         DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE kofrinhos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE depositantes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kofrinho_id  INTEGER NOT NULL REFERENCES kofrinhos(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  valor        REAL NOT NULL,            -- mínimo R$ 0,50
  recorrencia  TEXT NOT NULL CHECK(recorrencia IN ('anual','mensal','semanal','diario')),
  email        TEXT,                     -- obrigatório na criação
  telefone     TEXT,                     -- opcional; usado para WhatsApp
  data_inicio  TEXT,                     -- YYYY-MM-DD; null = envio imediato
  criado_em    DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE agendamentos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  depositante_id   INTEGER NOT NULL REFERENCES depositantes(id) ON DELETE CASCADE,
  kofrinho_id      INTEGER NOT NULL REFERENCES kofrinhos(id) ON DELETE CASCADE,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorrencia      TEXT NOT NULL,
  proxima_execucao DATETIME NOT NULL,    -- quando o scheduler dispara o próximo envio
  ultima_execucao  DATETIME,
  ativo            INTEGER NOT NULL DEFAULT 1,
  criado_em        DATETIME DEFAULT CURRENT_TIMESTAMP
)

CREATE TABLE solicitacoes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id TEXT UNIQUE NOT NULL,   -- UUID gerado pelo scheduler
  kofrinho_id    INTEGER NOT NULL REFERENCES kofrinhos(id) ON DELETE CASCADE,
  depositante_id INTEGER NOT NULL REFERENCES depositantes(id) ON DELETE CASCADE,
  valor          REAL NOT NULL,
  pago           INTEGER NOT NULL DEFAULT 0,  -- 0 = A Pagar, 1 = Paga
  pago_em        DATETIME,
  pix_url        TEXT,                   -- base64 do QR Code retornado pela Confrapix
  pix_code       TEXT,                   -- código copia-e-cola
  criado_em      DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Índices**: `idx_kofrinhos_user_id`, `idx_users_email`, `idx_depositantes_kofrinho_id`, `idx_agendamentos_depositante_id`, `idx_agendamentos_proxima_execucao`, `idx_solicitacoes_kofrinho_id`.

---

## Documentação interativa (Swagger UI)

A API é documentada com **Swagger UI** (OpenAPI 3.0). Com o servidor rodando, acesse:

| Ambiente | URL |
|----------|-----|
| Desenvolvimento | http://localhost:3000/api/docs |
| Produção | https://api.mandacaru.org/api/docs |

A interface permite explorar todos os endpoints, ver os schemas de request/response e executar chamadas diretamente pelo browser — incluindo rotas protegidas com JWT (clique em **Authorize** e cole o access token obtido em `/api/auth/login`).

---

## API REST

Base local: `http://localhost:3000/api`  
Base produção: `https://api.mandacaru.org/api`

Autenticação: `Authorization: Bearer <access_token>` nas rotas protegidas.  
Todas as respostas são **JSON**, incluindo erros 404 (`{ "erro": "Rota não encontrada" }`).

### Auth (sem token)

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

#### `POST /api/auth/register`

```json
// Requisição
{ "nome_completo": "João Silva", "email": "joao@exemplo.com", "senha": "Senha@123" }

// Resposta 201
{
  "message": "Usuário cadastrado com sucesso",
  "user": { "id": 1, "nome_completo": "João Silva", "email": "joao@exemplo.com", "foto_avatar": null, "criado_em": "2026-06-23T10:00:00.000Z" },
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

Requisitos de senha: mínimo 8 caracteres, maiúscula, minúscula, número e caractere especial (`!@#$%^&*`).

#### `POST /api/auth/login`

```json
// Requisição
{ "email": "joao@exemplo.com", "senha": "Senha@123" }

// Resposta 200 — mesmo formato do register
```

#### `POST /api/auth/refresh`

```json
// Requisição
{ "refreshToken": "eyJhbGciOiJIUzI1NiJ9..." }

// Resposta 200
{ "token": "novo_access_token", "refreshToken": "mesmo_refresh_token" }
```

#### `POST /api/auth/forgot-password`

```json
{ "email": "joao@exemplo.com" }
// Resposta 200: { "message": "Email de recuperação enviado com sucesso" }
```

#### `POST /api/auth/reset-password`

```json
{ "token": "token_recebido_por_email", "novaSenha": "NovaSenha@456" }
// Resposta 200: { "message": "Senha redefinida com sucesso" }
```

---

### Kofrinhos (requer token)

```
GET    /api/kofrinhos
POST   /api/kofrinhos
GET    /api/kofrinhos/:id
PUT    /api/kofrinhos/:id
DELETE /api/kofrinhos/:id
```

#### `GET /api/kofrinhos`

```json
// Resposta 200
{
  "kofrinhos": [
    {
      "id": 1,
      "user_id": 1,
      "nome": "Viagem Europa",
      "descricao": "Reserva para viagem em 2027",
      "saldo": 1500.00,
      "criado_em": "2026-06-23T10:00:00.000Z"
    }
  ]
}
```

O campo `saldo` é calculado em tempo real: `SUM(valor) WHERE pago = 1` das solicitações do kofrinho.

#### `POST /api/kofrinhos`

```json
// Requisição
{ "nome": "Viagem Europa", "descricao": "Reserva para viagem em 2027" }

// Resposta 201
{ "message": "Kofrinho criado com sucesso", "kofrinho": { "id": 1, ... } }
```

#### `PUT /api/kofrinhos/:id`

```json
// Todos os campos são opcionais
{ "nome": "Viagem Europa 2027", "descricao": "Atualizado" }
```

---

### Depositantes (requer token)

Os depositantes pertencem a um kofrinho. Na criação, um agendamento é criado automaticamente.

```
GET    /api/kofrinhos/:id/depositantes
POST   /api/kofrinhos/:id/depositantes
PUT    /api/kofrinhos/:id/depositantes/:depositanteId
DELETE /api/kofrinhos/:id/depositantes/:depositanteId
```

#### `POST /api/kofrinhos/:id/depositantes`

```json
// Requisição
{
  "nome": "Maria Souza",
  "valor": 100.00,
  "recorrencia": "mensal",
  "email": "maria@exemplo.com",
  "telefone": "(11) 98765-4321",   // opcional; habilita WhatsApp
  "data_inicio": "2026-07-01"      // opcional; null = envio imediato
}

// Resposta 201
{
  "message": "Depositante criado com sucesso",
  "depositante": {
    "id": 1,
    "kofrinho_id": 1,
    "nome": "Maria Souza",
    "valor": 100.00,
    "recorrencia": "mensal",
    "email": "maria@exemplo.com",
    "telefone": "(11) 98765-4321",
    "data_inicio": "2026-07-01",
    "criado_em": "2026-06-23T10:00:00.000Z"
  }
}
```

Recorrências válidas: `diario`, `semanal`, `mensal`, `anual`.  
Valor mínimo: R$ 0,50.

#### `PUT /api/kofrinhos/:id/depositantes/:depositanteId`

Todos os campos são opcionais. Se `recorrencia` ou `data_inicio` mudarem, o agendamento é recalculado.

```json
{ "nome": "Maria Silva", "valor": 150.00, "recorrencia": "mensal" }
```

---

### Solicitações (requer token)

```
GET /api/kofrinhos/:id/solicitacoes
GET /api/kofrinhos/:id/solicitacoes/eventos   # SSE
GET /api/kofrinhos/eventos                    # SSE do dashboard
```

#### `GET /api/kofrinhos/:id/solicitacoes`

```json
// Resposta 200
{
  "solicitacoes": [
    {
      "id": 1,
      "solicitacao_id": "550e8400-e29b-41d4-a716-446655440000",
      "kofrinho_id": 1,
      "depositante_id": 1,
      "depositante_nome": "Maria Souza",
      "valor": 100.00,
      "pago": 1,
      "pago_em": "2026-06-23 12:30:00",
      "criado_em": "2026-06-23T10:00:00.000Z"
    }
  ]
}
```

`pago`: `0` = A Pagar, `1` = Paga.

#### SSE — eventos em tempo real

```
GET /api/kofrinhos/:id/solicitacoes/eventos   # eventos de um kofrinho específico
GET /api/kofrinhos/eventos                    # eventos do usuário (todos os kofrinhos)
```

Ambos retornam `text/event-stream`. O cliente re-busca os dados via API ao receber qualquer evento. Heartbeat a cada 30s para manter a conexão viva em proxies.

Eventos possíveis: `solicitacao_criada`, `solicitacao_confirmada`, `saldo_atualizado`.

```js
const es = new EventSource('https://api.mandacaru.org/api/kofrinhos/1/solicitacoes/eventos', {
  headers: { Authorization: 'Bearer <token>' }
})
es.onmessage = (e) => {
  const { tipo } = JSON.parse(e.data)
  if (tipo === 'solicitacao_confirmada') recarregarSolicitacoes()
}
```

---

### Webhook Confrapix (sem token)

```
POST /api/solicitacoes/:solicitacaoId
```

Chamado pela Confrapix quando o pagamento Pix é confirmado. Marca a solicitação como paga, notifica SSE e envia e-mail de confirmação ao depositante. Idempotente: chamadas repetidas retornam 200 sem reprocessar.

---

### Avatares (requer token)

```
POST   /api/avatars/upload   # multipart/form-data, campo "avatar"
DELETE /api/avatars
```

---

### Página pública da solicitação (HTML, sem token)

```
GET /solicitacoes/:solicitacaoId            # Página HTML com QR Code + copia-e-cola
GET /solicitacoes/:solicitacaoId/qrcode.png # Imagem PNG do QR Code
```

Estas rotas são servidas pelo backend Express, não pela SPA React. O Caddy precisa fazer proxy de `/solicitacoes/*` para o backend **antes** do fallback `try_files`.

---

### Health check

```
GET /api/health
// { "status": "ok", "message": "Server running on port 3000" }
```

---

## Fluxo completo: do depositante ao saldo

```
1. Dono cria depositante (POST /api/kofrinhos/:id/depositantes)
   └─ Backend cria agendamento com proxima_execucao = data_inicio ou agora

2. Agendador (polling 1s) detecta proxima_execucao <= agora
   ├─ Chama Confrapix → recebe pixUrl (base64 QR Code) + pixCode (copia-e-cola)
   ├─ Grava solicitação no banco (pago = 0)
   ├─ Salva QR Code como PNG em disco (uploads/qrcodes/)
   ├─ Notifica SSE: solicitacao_criada
   ├─ Envia e-mail via Resend com QR Code embutido + código copia-e-cola
   ├─ Envia WhatsApp (se telefone cadastrado) com link para /solicitacoes/:id
   └─ Avança proxima_execucao = agora + recorrência

3. Depositante acessa link no WhatsApp ou escaneia QR Code do e-mail
   └─ Realiza pagamento Pix

4. Confrapix chama webhook (POST /api/solicitacoes/:solicitacaoId)
   ├─ Backend marca pago = 1
   ├─ Notifica SSE: solicitacao_confirmada + saldo_atualizado
   └─ Envia e-mail e WhatsApp de confirmação ao depositante

5. Dashboard do dono atualiza saldo ao vivo via SSE (GET /api/kofrinhos/eventos)
```

---

## Arquitetura do frontend

### Gerenciamento de estado (`KofrinhoContext`)

```
Estado global:
  kofrinhos[]          ← lista do dashboard
  selectedKofrinho     ← kofrinho aberto em KofrinhoDetails
  depositantes[]       ← depositantes do selectedKofrinho
  solicitacoes[]       ← solicitações do selectedKofrinho
  loading / error

Operações com useCallback (deps []):
  selectKofrinho(id)        → GET /kofrinhos/:id
  fetchDepositantes(id)     → GET /kofrinhos/:id/depositantes
  fetchSolicitacoes(id)     → GET /kofrinhos/:id/solicitacoes

Motivo: estão em deps de useEffect — sem memo geram loop infinito de chamadas.
```

### `client.ts` — ponto único de acesso à API

- `apiFetch`: wrapper do `fetch` nativo com tratamento de erros de rede.
- `handleResponse<T>`: verifica status HTTP e `Content-Type: application/json` antes de parsear — evita que respostas HTML (ex.: 404 padrão do Express) causem erros crípticos.
- `getStoredTokens` / `setStoredTokens`: lê/grava tokens no `localStorage`. Token 401 apaga os tokens e força novo login.

### Roteamento (React Router 7)

```
/                     → LandingPage (pública)
/app                  → Home (login/registro/dashboard por estado interno)
/kofrinho/:id         → KofrinhoDetails
```

### Auth (`AuthContext`)

`isAuthenticated = user !== null && tokens !== null`.

**Limitação atual**: ao recarregar a página o `user` não é restaurado do `localStorage` — o usuário precisa fazer login novamente. O `refreshToken` é salvo, mas não é usado automaticamente para restaurar a sessão.

---

## Arquitetura do backend

### Padrão de controllers — injeção de banco de teste

Todos os controllers aceitam `req.testDb` (banco SQLite de teste injetado pelo Jest). Se presente, usam esse banco; caso contrário, usam o banco real via os helpers de `db.ts`. Isso permite testar sem tocar o banco de produção.

```ts
function getDbAsync<T>(req: any, sql: string, params: any[]): Promise<T | undefined> {
  const db = req.testDb
  if (db) return new Promise((resolve, reject) => db.get(sql, params, ...))
  return getAsync<T>(sql, params)
}
```

### Middleware de auth

`router.use(authMiddleware)` intercepta **todos** os paths do router — incluindo rotas não registradas. Uma rota inexistente com token válido responde 404; sem token responde 401.

```
⚠️  Não use ausência de 401 como prova de que a rota existe.
    Teste sempre com token válido.
```

### Agendador (`schedulerService.ts`)

- Polling a cada 1 segundo via `setInterval`.
- `isProcessing` flag evita execuções concorrentes.
- Em testes E2E, desabilitado via `SCHEDULER_DISABLED=true`.
- Injetável nos testes unitários: `processarAgendamentos(db, sendFn, confrapixFn)`.

### Confrapix (`confrapixService.ts`)

Gateway Pix. Recebe valor, descrição e `callback_url` (webhook de confirmação). Retorna `pixUrl` (base64 do QR Code) e `pixCode` (copia-e-cola).

```ts
// Payload enviado à Confrapix
{
  amount: 100.00,
  description: "Viagem Europa",
  expiration_date: "2026-06-24 10:00:00",   // UTC, +24h
  callback_url: "https://api.mandacaru.org/api/solicitacoes/<uuid>"
}
```

### SSE (`solicitacaoController.ts`)

Dois mapas: `sseClients` (por kofrinho) e `sseUserClients` (por usuário). Quando o webhook de confirmação chega, `notificarKofrinho` e `notificarUsuario` escrevem no stream de todos os clientes conectados.

---

## Testes

### E2E (Playwright)

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # modo interativo
npm run test:e2e:debug    # passo a passo
```

`playwright.config.ts` sobe Vite (5173) e Express (3000) automaticamente com `reuseExistingServer: true`. Os servidores são iniciados com `TEST_ROUTES=true` e `SCHEDULER_DISABLED=true`.

A fixture `authenticatedPage` (em `e2e/fixtures.ts`) cria um usuário único por teste com e-mail `test${Date.now()}@example.com` e senha `Test@1234`.

| Arquivo | Cenários |
|---------|----------|
| `01-registration.spec.ts` | Registro |
| `02-login.spec.ts` | Login / logout |
| `03-kofrinho-crud.spec.ts` | CRUD kofrinho |
| `04-avatar-upload.spec.ts` | Upload de avatar |
| `05-auth-persistence.spec.ts` | Persistência de sessão |
| `06-kofrinho-details.spec.ts` | Página de detalhes |
| `07-depositante.spec.ts` | Criar depositante |
| `08-depositante-delete.spec.ts` | Deletar depositante |
| `09-depositante-edit.spec.ts` | Editar depositante |
| `10-solicitacoes-confirmadas.spec.ts` | Listagem de solicitações |
| `11-novo-depositante.spec.ts` | Fluxo completo novo depositante |
| `12-data-inicio.spec.ts` | Data de início do agendamento |
| `13-saldo.spec.ts` | Cálculo de saldo |
| `14-landing.spec.ts` | Landing page |
| `15-solicitacao-pagina.spec.ts` | Página pública da solicitação |

### Unitários (Jest + Supertest)

```bash
cd server && npm test
cd server && npm run test:coverage
```

Os testes ficam em `server/src/__tests__/`. Usam `testDb` injetado — não tocam `kofrinho.sqlite`.

---

## Deploy — Caddy

O backend roda em `localhost:3000`. O Caddy faz reverse proxy com HTTPS automático.

```caddy
# Caddyfile (simplificado)
mandacaru.org {
    # 1. Rotas do backend Express (têm que vir antes do fallback SPA)
    handle /api/* {
        reverse_proxy localhost:3000
    }
    handle /solicitacoes/* {
        reverse_proxy localhost:3000
    }

    # 2. Qualquer outra URL serve o index.html da SPA
    handle {
        root * /caminho/para/kofrinho/dist
        try_files {path} /index.html
        file_server
    }
}

api.mandacaru.org {
    reverse_proxy localhost:3000
}
```

> **Atenção**: `/solicitacoes/*` deve vir **antes** do `try_files`. Sem isso, o Caddy
> serve o `index.html` da SPA em vez da página HTML do backend.

---

## Armadilhas documentadas

| Situação | Sintoma | Causa | Como evitar |
|----------|---------|-------|-------------|
| Mudança no backend sem rebuild | Comportamento antigo ou 404 | `node dist/index.js` carrega arquivos em memória | Sempre `npm run build` + restart |
| Testar rota sem token | Recebe 401, acha que a rota existe | `router.use(authMiddleware)` intercepta antes do match | Sempre testar com token |
| Função de contexto em `useEffect` deps | Loop infinito de chamadas | Nova referência a cada render → `useEffect` re-dispara | `useCallback` com deps `[]` |
| `handleResponse` sem checar Content-Type | `JSON.parse` explode com erro bruto | Express retorna HTML para 404 padrão | Verificar `Content-Type: application/json` antes |
| `/solicitacoes/*` sem proxy no Caddy | Abre a SPA em vez da página do backend | `try_files` captura antes do backend | Adicionar `handle /solicitacoes/*` antes do `try_files` |
| `SCHEDULER_DISABLED` ausente nos testes | Agendador dispara durante E2E | Polling a cada 1s concorre com os testes | Definir `SCHEDULER_DISABLED=true` nos testes |
| `NODE_ENV` não definido como `production` | E-mails e WhatsApp não são enviados | `envioDeEmailHabilitado()` retorna false fora de prod | Definir `NODE_ENV=production` no servidor de produção |
