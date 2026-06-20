import { test, expect } from './fixtures'

const SERVER = 'http://localhost:3000'
const API = `${SERVER}/api`

async function criarKofrinhoUI(page: any, nome: string) {
  await page.click('button:has-text("Criar novo Kofrinho")')
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('input[id="nome"]', nome)
  await page.click('.modal-content button:has-text("Criar Kofrinho")')
  await expect(page.locator('.kofrinho-card').filter({ hasText: nome })).toBeVisible({ timeout: 8000 })
}

async function getKofrinhoId(page: any, nome: string): Promise<number> {
  const id = await page.evaluate(
    async ({ api, nome }: any) => {
      const tokens = JSON.parse(localStorage.getItem('authTokens') || 'null')
      const res = await fetch(`${api}/kofrinhos`, { headers: { Authorization: `Bearer ${tokens?.token ?? ''}` } })
      const data = await res.json()
      return (data.kofrinhos as any[]).find((k) => k.nome === nome)?.id ?? null
    },
    { api: API, nome }
  )
  expect(id).not.toBeNull()
  return id as number
}

async function criarDepositante(page: any, kofrinhoId: number): Promise<number> {
  const result = await page.evaluate(
    async ({ server, kofrinhoId }: any) => {
      const res = await fetch(`${server}/test/depositantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kofrinho_id: kofrinhoId, nome: 'Dep Saldo', valor: 100, recorrencia: 'mensal', email: 'saldo@teste.com' }),
      })
      return { status: res.status, body: await res.json() }
    },
    { server: SERVER, kofrinhoId }
  )
  expect(result.status).toBe(201)
  return result.body.depositante.id
}

// Cria uma solicitação pendente e, se `pagar`, confirma via webhook (pago=1)
async function criarSolicitacao(page: any, kofrinhoId: number, depositanteId: number, valor: number, pagar: boolean) {
  const solicitacaoId = `e2e-saldo-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const r = await page.evaluate(
    async ({ server, solicitacaoId, kofrinhoId, depositanteId, valor }: any) => {
      const res = await fetch(`${server}/test/solicitacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitacao_id: solicitacaoId, kofrinho_id: kofrinhoId, depositante_id: depositanteId, valor }),
      })
      return res.status
    },
    { server: SERVER, solicitacaoId, kofrinhoId, depositanteId, valor }
  )
  expect(r).toBe(201)

  if (pagar) {
    const status = await page.evaluate(
      async ({ api, solicitacaoId }: any) => {
        const res = await fetch(`${api}/solicitacoes/${solicitacaoId}`, { method: 'POST' })
        return res.status
      },
      { api: API, solicitacaoId }
    )
    expect(status).toBe(200)
  }
}

test.describe('Saldo do kofrinho', () => {
  test('saldo no card e nos detalhes corresponde ao somatório das solicitações pagas', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho Saldo ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositanteId = await criarDepositante(page, kofrinhoId)

    // duas solicitações pagas (300 + 200 = 500) e uma não paga (999, ignorada)
    await criarSolicitacao(page, kofrinhoId, depositanteId, 300, true)
    await criarSolicitacao(page, kofrinhoId, depositanteId, 200, true)
    await criarSolicitacao(page, kofrinhoId, depositanteId, 999, false)

    // detalhes: saldo abaixo da descrição, no alto
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    const saldoDetalhes = page.locator('.kofrinho-details-saldo-valor')
    await expect(saldoDetalhes).toBeVisible({ timeout: 8000 })
    await expect(saldoDetalhes).toContainText('500,00')
    await expect(saldoDetalhes).not.toContainText('999')

    // volta ao dashboard: o card também mostra o saldo
    await page.click('.btn-back')
    await expect(page).toHaveURL(/\/$/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    const card = page.locator('.kofrinho-card').filter({ hasText: nome })
    await expect(card.locator('.kofrinho-saldo-valor')).toContainText('500,00')
  })

  test('saldo nos detalhes atualiza ao vivo (SSE) ao confirmar uma solicitação', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho Live ${Date.now()}`
    await criarKofrinhoUI(page, nome)
    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositanteId = await criarDepositante(page, kofrinhoId)

    // solicitação pendente (pago=0): o saldo começa em 0
    const solicitacaoId = `e2e-live-${Date.now()}`
    const status = await page.evaluate(
      async ({ server, solicitacaoId, kofrinhoId, depositanteId }: any) => {
        const res = await fetch(`${server}/test/solicitacoes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ solicitacao_id: solicitacaoId, kofrinho_id: kofrinhoId, depositante_id: depositanteId, valor: 450 }),
        })
        return res.status
      },
      { server: SERVER, solicitacaoId, kofrinhoId, depositanteId }
    )
    expect(status).toBe(201)

    // abre os detalhes (inicia a conexão SSE) — saldo 0
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.kofrinho-details-saldo-valor')).toContainText('0,00')

    // confirma o pagamento via webhook (dispara o evento SSE) — sem recarregar a página
    await page.evaluate(
      async ({ api, solicitacaoId }: any) => { await fetch(`${api}/solicitacoes/${solicitacaoId}`, { method: 'POST' }) },
      { api: API, solicitacaoId }
    )

    // o saldo deve atualizar ao vivo para 450,00
    await expect(page.locator('.kofrinho-details-saldo-valor')).toContainText('450,00', { timeout: 10000 })
  })

  test('kofrinho sem solicitações pagas mostra saldo zero', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho Zero ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const card = page.locator('.kofrinho-card').filter({ hasText: nome })
    await expect(card.locator('.kofrinho-saldo-valor')).toContainText('0,00')
  })
})
