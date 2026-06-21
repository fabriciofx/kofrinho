import { test, expect } from '@playwright/test'

const SERVER = 'http://localhost:3000'
const API = `${SERVER}/api`

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
// devolve o solicitacao_id. A página em si é HTML servido pelo backend.
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

test.describe('Página pública da solicitação (HTML)', () => {
  test('exibe o QR Code como imagem e o código Pix copia-e-cola', async ({ page }) => {
    const solicitacaoId = await prepararSolicitacao(500)

    // Página servida pelo backend (em produção: mandacaru.org/solicitacoes/:id)
    await page.goto(`${SERVER}/solicitacoes/${solicitacaoId}`)

    // Mensagem (mesmo conteúdo do e-mail) + valor + referência
    await expect(page.locator('text=Eu sou o Kofrinho')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('body')).toContainText('500,00')
    await expect(page.locator('body')).toContainText('Viagem 2026')

    // QR Code é uma imagem de verdade (<img>) que carrega
    const qrcode = page.locator('img.qrcode')
    await expect(qrcode).toBeVisible()
    await expect(qrcode).toHaveAttribute('src', `/solicitacoes/${solicitacaoId}/qrcode.png`)
    const carregou = await qrcode.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
    )
    expect(carregou).toBe(true)

    // Código Pix copia-e-cola visível
    await expect(page.locator('#pix-code')).toHaveText(PIX_CODE)
  })

  test('a imagem do QR Code responde como PNG', async ({ request }) => {
    const solicitacaoId = await prepararSolicitacao(123)

    const res = await request.get(`${SERVER}/solicitacoes/${solicitacaoId}/qrcode.png`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toBe('image/png')
    const body = await res.body()
    expect(body.slice(0, 4).toString('hex')).toBe('89504e47') // assinatura PNG
  })

  test('o botão copia o código Pix para a área de transferência', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    const solicitacaoId = await prepararSolicitacao(250)
    await page.goto(`${SERVER}/solicitacoes/${solicitacaoId}`)

    const botao = page.locator('#copiar')
    await expect(botao).toBeVisible({ timeout: 8000 })
    await botao.click()

    // Feedback visual
    await expect(botao).toHaveText('Copiado!')

    // Conteúdo realmente copiado
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toBe(PIX_CODE)
  })

  test('exibe página de erro para solicitação inexistente', async ({ page }) => {
    const resp = await page.goto(`${SERVER}/solicitacoes/uuid-que-nao-existe`)
    expect(resp?.status()).toBe(404)
    await expect(page.locator('body')).toContainText('não encontrada')
    await expect(page.locator('img.qrcode')).toHaveCount(0)
  })
})
