import { test, expect } from '@playwright/test'

const SERVER = 'http://localhost:3000'
const API = `${SERVER}/api`

// Em dev, VITE_API_URL pode apontar para a API de produção. Como a página usa
// o client da app (API_BASE_URL), reescrevemos as chamadas dela para o servidor
// local, mantendo o teste autocontido sem depender da configuração do .env.
const PROD_API = 'https://api.mandacaru.org/api'

async function rotearApiParaLocal(page: any) {
  await page.route(`${PROD_API}/**`, async (route: any) => {
    const localUrl = route.request().url().replace(PROD_API, API)
    const response = await route.fetch({ url: localUrl })
    await route.fulfill({ response })
  })
}

// QR Code 1x1 (PNG) e código Pix copia-e-cola conhecidos, usados nas asserções
const PIX_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const PIX_CODE = '00020126580014br.gov.bcb.pix0136e2e-copia-e-cola-abcdef1234567890'

// E-mails criados durante os testes, removidos (em cascata) no teardown
const emailsParaLimpar: string[] = []

test.afterAll(async () => {
  for (const email of emailsParaLimpar) {
    await fetch(`${SERVER}/test/users/${encodeURIComponent(email)}`, { method: 'DELETE' }).catch(() => {})
  }
})

// Cria usuário + kofrinho + depositante + solicitação (com Pix) via API e
// devolve o solicitacao_id. Não depende da UI de login.
async function prepararSolicitacao(valor: number): Promise<string> {
  const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const email = `e2e-pagina-${sufixo}@example.com`
  emailsParaLimpar.push(email)

  const reg = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome_completo: 'Dona do Cofre', email, senha: 'Test@1234' }),
  })
  expect(reg.status).toBe(201)
  const { token } = await reg.json()

  const kRes = await fetch(`${API}/kofrinhos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nome: `Cofre ${sufixo}`, descricao: 'Viagem 2026' }),
  })
  expect(kRes.status).toBe(201)
  const kofrinhoId = (await kRes.json()).kofrinho.id

  const dRes = await fetch(`${SERVER}/test/depositantes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kofrinho_id: kofrinhoId, nome: 'Depositante Pix', valor, recorrencia: 'mensal' }),
  })
  expect(dRes.status).toBe(201)
  const depositanteId = (await dRes.json()).depositante.id

  const solicitacaoId = `e2e-pagina-${sufixo}`
  const sRes = await fetch(`${SERVER}/test/solicitacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      solicitacao_id: solicitacaoId,
      kofrinho_id: kofrinhoId,
      depositante_id: depositanteId,
      valor,
      pix_url: PIX_URL,
      pix_code: PIX_CODE,
    }),
  })
  expect(sRes.status).toBe(201)

  return solicitacaoId
}

test.describe('Página pública da solicitação', () => {
  test.beforeEach(async ({ page }) => {
    await rotearApiParaLocal(page)
  })

  test('exibe o QR Code e o código Pix copia-e-cola', async ({ page }) => {
    const solicitacaoId = await prepararSolicitacao(500)

    await page.goto(`/solicitacoes/${solicitacaoId}`)

    // Mensagem (mesmo conteúdo do e-mail) + valor formatado + referência
    await expect(page.locator('text=Eu sou o Kofrinho')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('text=R$ 500,00')).toBeVisible()
    await expect(page.locator('text=Viagem 2026')).toBeVisible()

    // QR Code renderizado a partir do data URL
    const qrcode = page.locator('.solicitacao-qrcode')
    await expect(qrcode).toBeVisible()
    await expect(qrcode).toHaveAttribute('src', PIX_URL)

    // Código Pix copia-e-cola visível
    await expect(page.getByTestId('pix-code')).toHaveText(PIX_CODE)
  })

  test('o botão copia o código Pix para a área de transferência', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    const solicitacaoId = await prepararSolicitacao(250)
    await page.goto(`/solicitacoes/${solicitacaoId}`)

    const botao = page.getByTestId('copiar-pix')
    await expect(botao).toBeVisible({ timeout: 8000 })
    await botao.click()

    // Feedback visual
    await expect(botao).toHaveText('Copiado!')

    // Conteúdo realmente copiado
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe(PIX_CODE)
  })

  test('exibe mensagem de erro para solicitação inexistente', async ({ page }) => {
    await page.goto('/solicitacoes/uuid-que-nao-existe')

    await expect(page.locator('.solicitacao-erro')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.solicitacao-qrcode')).toHaveCount(0)
  })
})
