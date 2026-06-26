import { Request, Response } from 'express'
import { getAsync, allAsync, runAsync } from '../database/db.js'
import { AuthRequest } from '../middleware/auth.js'
import { Solicitacao } from '../types/index.js'
import { sendSolicitacaoConfirmadaEmail } from '../services/emailService.js'
import { extrairBase64, salvarQrcodeBuffer } from '../utils/qrcodeStorage.js'

// ─── SSE: registro de clientes por kofrinho ───────────────────────────────────
const sseClients = new Map<number, Set<Response>>()

function adicionarSseClient(kofrinhoId: number, res: Response): void {
  if (!sseClients.has(kofrinhoId)) sseClients.set(kofrinhoId, new Set())
  sseClients.get(kofrinhoId)!.add(res)
}

function removerSseClient(kofrinhoId: number, res: Response): void {
  const set = sseClients.get(kofrinhoId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) sseClients.delete(kofrinhoId)
}

// Notifica os clientes SSE de um kofrinho para que recarreguem as solicitações.
// `tipo` é informativo; o frontend re-busca a lista em qualquer evento de solicitação.
export function notificarKofrinho(kofrinhoId: number, tipo = 'solicitacao_atualizada'): void {
  const clients = sseClients.get(kofrinhoId)
  if (!clients) return
  for (const res of clients) {
    res.write(`data: ${JSON.stringify({ tipo })}\n\n`)
  }
}

// ─── SSE: registro de clientes por usuário (dashboard) ─────────────────────────
// Usado para atualizar o saldo dos cards ao vivo, com uma única conexão por usuário.
const sseUserClients = new Map<number, Set<Response>>()

function adicionarSseUserClient(userId: number, res: Response): void {
  if (!sseUserClients.has(userId)) sseUserClients.set(userId, new Set())
  sseUserClients.get(userId)!.add(res)
}

function removerSseUserClient(userId: number, res: Response): void {
  const set = sseUserClients.get(userId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) sseUserClients.delete(userId)
}

// Notifica os clientes SSE de um usuário (todos os seus kofrinhos no dashboard).
export function notificarUsuario(userId: number, tipo = 'saldo_atualizado'): void {
  const clients = sseUserClients.get(userId)
  if (!clients) return
  for (const res of clients) {
    res.write(`data: ${JSON.stringify({ tipo })}\n\n`)
  }
}

interface DbInjectedRequest extends Request {
  testDb?: any
}

interface DbInjectedAuthRequest extends AuthRequest {
  testDb?: any
}

function getDbAsync<T>(req: any, sql: string, params: any[]) {
  const db = req.testDb
  if (db) {
    return new Promise<T | undefined>((resolve, reject) => {
      db.get(sql, params, (err: Error | null, row: T) => {
        if (err) reject(err)
        else resolve(row as T | undefined)
      })
    })
  }
  return getAsync<T>(sql, params)
}

function allDbAsync<T>(req: any, sql: string, params: any[]) {
  const db = req.testDb
  if (db) {
    return new Promise<T[]>((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: T[]) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  }
  return allAsync<T>(sql, params)
}

function runDbAsync(req: any, sql: string, params: any[]): Promise<void> {
  const db = req.testDb
  if (db) {
    return new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: Error | null) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
  return runAsync(sql, params)
}

// Webhook chamado pela Confrapix quando a solicitação é confirmada
// POST /api/solicitacoes/:solicitacaoId
export async function registrarSolicitacao(req: DbInjectedRequest, res: Response) {
  try {
    const { solicitacaoId } = req.params

    const solicitacao = await getDbAsync<{ id: number; pago: number; kofrinho_id: number; user_id: number }>(req,
      `SELECT s.id, s.pago, s.kofrinho_id, k.user_id
       FROM solicitacoes s JOIN kofrinhos k ON s.kofrinho_id = k.id
       WHERE s.solicitacao_id = ?`,
      [solicitacaoId]
    )
    if (!solicitacao) {
      return res.status(404).json({ erro: 'Solicitação não encontrada' })
    }

    // Idempotência: chamadas repetidas do webhook não disparam novo e-mail
    if (solicitacao.pago === 1) {
      return res.status(200).json({ message: 'Solicitação já confirmada' })
    }

    await runDbAsync(req,
      'UPDATE solicitacoes SET pago = 1, pago_em = CURRENT_TIMESTAMP WHERE solicitacao_id = ?',
      [solicitacaoId]
    )

    notificarKofrinho(solicitacao.kofrinho_id, 'solicitacao_confirmada')
    // Atualiza o saldo dos cards no dashboard do dono ao vivo
    notificarUsuario(solicitacao.user_id, 'saldo_atualizado')

    // Busca dados para o e-mail de confirmação e dispara de forma assíncrona
    const dadosEmail = await getDbAsync<{
      pago_em: string
      valor: number
      depositante_nome: string
      depositante_email: string | null
      depositante_telefone: string | null
      kofrinho_nome: string
      kofrinho_descricao: string | null
    }>(req,
      `SELECT p.pago_em, p.valor,
              d.nome AS depositante_nome, d.email AS depositante_email,
              d.telefone AS depositante_telefone,
              k.nome AS kofrinho_nome, k.descricao AS kofrinho_descricao
       FROM solicitacoes p
       JOIN depositantes d ON p.depositante_id = d.id
       JOIN kofrinhos k ON p.kofrinho_id = k.id
       WHERE p.solicitacao_id = ?`,
      [solicitacaoId]
    )

    if (dadosEmail?.depositante_email) {
      sendSolicitacaoConfirmadaEmail(
        dadosEmail.depositante_email,
        dadosEmail.depositante_nome,
        dadosEmail.kofrinho_nome,
        dadosEmail.kofrinho_descricao,
        dadosEmail.valor,
        dadosEmail.pago_em,
        dadosEmail.depositante_telefone
      ).catch(err => console.error('❌ Erro ao enviar e-mail de confirmação:', err))
    }

    console.log(`✅ Solicitação confirmada: ${solicitacaoId}`)
    return res.status(200).json({ message: 'Solicitação confirmada com sucesso' })
  } catch (err) {
    console.error('❌ Erro ao confirmar solicitação:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Escapa texto para inserção segura em HTML (nome do dono, kofrinho etc. vêm
// de entrada do usuário).
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function paginaHtml(titulo: string, conteudo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escaparHtml(titulo)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
      padding: 2.5rem 2rem;
      max-width: 460px;
      width: 100%;
      text-align: center;
    }
    h1 { margin: 0 0 1rem; font-size: 1.5rem; color: #333; }
    h2 { margin: 1.5rem 0 0.5rem; font-size: 1.2rem; color: #5a3d99; }
    p { color: #444; line-height: 1.6; }
    .qrcode {
      display: block;
      width: 220px;
      height: 220px;
      margin: 1rem auto;
      border: 1px solid #eee;
      border-radius: 8px;
      background: #fff;
      image-rendering: pixelated;
    }
    .pix-code {
      background: #f5f5f5;
      padding: 0.85rem;
      border-radius: 8px;
      word-break: break-all;
      white-space: pre-wrap;
      font-size: 0.8rem;
      text-align: left;
      color: #333;
      margin: 0.5rem 0 1rem;
    }
    .copiar {
      width: 100%;
      padding: 0.85rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    .copiar:hover { opacity: 0.9; }
    .pago {
      background: #e8f5e9;
      color: #2e7d32;
      padding: 1rem;
      border-radius: 8px;
      font-weight: 600;
    }
    .erro { color: #c0392b; }
  </style>
</head>
<body>
  <div class="card">
${conteudo}
  </div>
</body>
</html>`
}

// Página web pública (HTML) da solicitação: exibe o QR Code como imagem e o
// código Pix copia-e-cola, com botão para copiar. Servida em
// mandacaru.org/solicitacoes/:id (sem auth, sem chamada à API pelo browser).
// GET /solicitacoes/:solicitacaoId
export async function paginaSolicitacao(req: DbInjectedRequest, res: Response) {
  try {
    const { solicitacaoId } = req.params

    const solicitacao = await getDbAsync<{
      valor: number
      pago: number
      pix_code: string | null
      dono_nome: string
      kofrinho_nome: string
      kofrinho_descricao: string | null
    }>(req,
      `SELECT s.valor, s.pago, s.pix_code,
              u.nome_completo AS dono_nome,
              k.nome AS kofrinho_nome, k.descricao AS kofrinho_descricao
       FROM solicitacoes s
       JOIN kofrinhos k ON s.kofrinho_id = k.id
       JOIN users u     ON k.user_id     = u.id
       WHERE s.solicitacao_id = ?`,
      [solicitacaoId]
    )

    res.setHeader('Content-Type', 'text/html; charset=utf-8')

    if (!solicitacao) {
      return res.status(404).send(paginaHtml(
        'Solicitação não encontrada',
        `    <h1>Kofrinho 🐷</h1>
    <p class="erro">Solicitação não encontrada.</p>`
      ))
    }

    const valorFormatado = formatarValor(solicitacao.valor)
    const referencia = escaparHtml(solicitacao.kofrinho_descricao || solicitacao.kofrinho_nome)
    const dono = escaparHtml(solicitacao.dono_nome)
    const qrcodeUrl = `/solicitacoes/${encodeURIComponent(solicitacaoId)}/qrcode.png`

    let corpo = `    <h1>Olá! Eu sou o Kofrinho! 🐷</h1>
    <p>Estou lhe enviando essa mensagem para lembrar-lhe de depositar
       <strong>${escaparHtml(valorFormatado)}</strong> no Kofrinho de
       <strong>${dono}</strong> referente a <strong>${referencia}</strong>.</p>`

    if (solicitacao.pago === 1) {
      corpo += `
    <p class="pago">✅ Este depósito já foi confirmado. Obrigado!</p>`
    } else {
      // Aviso de confirmação ao vivo: começa oculto e é exibido pelo polling
      // assim que o webhook da Confrapix marcar a solicitação como paga.
      corpo += `
    <p class="pago" id="aviso-pago" style="display: none;">✅ Pagamento confirmado! Obrigado pelo seu depósito. 🐷</p>
    <div id="secao-pagamento">
    <h2>Pagamento via Pix</h2>
    <p>Escaneie o QR Code abaixo ou use o código Pix para realizar o depósito:</p>
    <img class="qrcode" src="${qrcodeUrl}" alt="QR Code Pix" width="220" height="220" />`

      if (solicitacao.pix_code) {
        corpo += `
    <p><strong>Código Pix (Copia e Cola):</strong></p>
    <pre class="pix-code" id="pix-code">${escaparHtml(solicitacao.pix_code)}</pre>
    <button type="button" class="copiar" id="copiar">Copiar código Pix</button>
    <script>
      (function () {
        var btn = document.getElementById('copiar');
        var code = document.getElementById('pix-code').textContent;
        btn.addEventListener('click', function () {
          function feedback() {
            btn.textContent = 'Copiado!';
            setTimeout(function () { btn.textContent = 'Copiar código Pix'; }, 2500);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(feedback).catch(function () {
              fallback(); feedback();
            });
          } else {
            fallback(); feedback();
          }
          function fallback() {
            var ta = document.createElement('textarea');
            ta.value = code;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
          }
        });
      })();
    </script>`
      }

      corpo += `
    </div>
    <script>
      (function () {
        var statusUrl = ${JSON.stringify(`/solicitacoes/${encodeURIComponent(solicitacaoId)}/status`)};
        var timer = setInterval(verificar, 4000);

        function confirmar() {
          clearInterval(timer);
          var secao = document.getElementById('secao-pagamento');
          if (secao) secao.style.display = 'none';
          var aviso = document.getElementById('aviso-pago');
          if (aviso) aviso.style.display = 'block';
        }

        function verificar() {
          fetch(statusUrl, { headers: { 'Accept': 'application/json' }, cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) { if (data && data.pago) confirmar(); })
            .catch(function () { /* tenta novamente no próximo ciclo */ });
        }
      })();
    </script>`
    }

    return res.status(200).send(paginaHtml(
      `Depositar ${valorFormatado} — Kofrinho`,
      corpo
    ))
  } catch (err) {
    console.error('❌ Erro ao renderizar página da solicitação:', err)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.status(500).send(paginaHtml(
      'Erro',
      `    <h1>Kofrinho 🐷</h1>
    <p class="erro">Não foi possível carregar a solicitação.</p>`
    ))
  }
}

// Situação de pagamento da solicitação (JSON público, sem auth). Usado pela
// página pública para detectar a confirmação ao vivo, via polling.
// GET /solicitacoes/:solicitacaoId/status
export async function statusSolicitacao(req: DbInjectedRequest, res: Response) {
  try {
    const { solicitacaoId } = req.params

    const row = await getDbAsync<{ pago: number }>(req,
      'SELECT pago FROM solicitacoes WHERE solicitacao_id = ?',
      [solicitacaoId]
    )

    if (!row) {
      return res.status(404).json({ erro: 'Solicitação não encontrada' })
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ pago: row.pago === 1 })
  } catch (err) {
    console.error('❌ Erro ao consultar situação da solicitação:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Imagem do QR Code da solicitação (PNG). Decodifica o pix_url salvo no banco,
// grava o arquivo em disco (best effort) e responde a imagem.
// GET /solicitacoes/:solicitacaoId/qrcode.png
export async function qrcodeSolicitacao(req: DbInjectedRequest, res: Response) {
  try {
    const { solicitacaoId } = req.params

    const row = await getDbAsync<{ pix_url: string | null }>(req,
      'SELECT pix_url FROM solicitacoes WHERE solicitacao_id = ?',
      [solicitacaoId]
    )

    if (!row || !row.pix_url) {
      return res.status(404).json({ erro: 'QR Code não encontrado' })
    }

    const buffer = Buffer.from(extrairBase64(row.pix_url), 'base64')

    // "Salve o qr-code como uma imagem": grava em disco (sem bloquear a resposta)
    try {
      salvarQrcodeBuffer(solicitacaoId, buffer)
    } catch (err) {
      console.error(`❌ Erro ao salvar QR Code ${solicitacaoId}:`, err)
    }

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.status(200).send(buffer)
  } catch (err) {
    console.error('❌ Erro ao gerar imagem do QR Code:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// SSE: stream de eventos de solicitação para um kofrinho (requer auth)
// GET /api/kofrinhos/:id/solicitacoes/eventos
export async function streamSolicitacoesEventos(req: DbInjectedAuthRequest, res: Response): Promise<void> {
  const kofrinhoId = parseInt(req.params.id)
  const userId = req.userId!

  const kofrinho = await getDbAsync<{ id: number }>(req,
    'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
    [kofrinhoId, userId]
  )
  if (!kofrinho) {
    res.status(404).json({ erro: 'Kofrinho não encontrado' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write(': connected\n\n')
  adicionarSseClient(kofrinhoId, res)

  // Heartbeat a cada 30s para manter a conexão viva em proxies
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000)

  res.on('close', () => {
    clearInterval(heartbeat)
    removerSseClient(kofrinhoId, res)
  })
}

// SSE: stream de eventos do usuário para o dashboard (requer auth)
// GET /api/kofrinhos/eventos — usado para atualizar o saldo dos cards ao vivo
export async function streamUsuarioEventos(req: DbInjectedAuthRequest, res: Response): Promise<void> {
  const userId = req.userId!

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  res.write(': connected\n\n')
  adicionarSseUserClient(userId, res)

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000)

  res.on('close', () => {
    clearInterval(heartbeat)
    removerSseUserClient(userId, res)
  })
}

// Listagem de solicitações confirmadas de um kofrinho (requer auth)
// GET /api/kofrinhos/:id/solicitacoes
export async function listSolicitacoes(req: DbInjectedAuthRequest, res: Response) {
  try {
    const { id: kofrinhoId } = req.params
    const userId = req.userId

    const kofrinho = await getDbAsync<{ id: number }>(req,
      'SELECT id FROM kofrinhos WHERE id = ? AND user_id = ?',
      [kofrinhoId, userId]
    )
    if (!kofrinho) {
      return res.status(404).json({ erro: 'Kofrinho não encontrado' })
    }

    // Retorna todas as solicitações (pagas e a pagar) ordenadas pela data de envio.
    // A situação é derivada de `pago`: 0 → "A Pagar", 1 → "Paga".
    const solicitacoes = await allDbAsync<Solicitacao>(req,
      `SELECT p.id, p.solicitacao_id, p.kofrinho_id, p.depositante_id, p.valor, p.pago, p.pago_em, p.criado_em,
              d.nome AS depositante_nome
       FROM solicitacoes p
       JOIN depositantes d ON p.depositante_id = d.id
       WHERE p.kofrinho_id = ?
       ORDER BY p.criado_em DESC`,
      [kofrinhoId]
    )

    return res.status(200).json({ solicitacoes })
  } catch (err) {
    console.error('❌ Erro ao listar solicitações:', err)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}
