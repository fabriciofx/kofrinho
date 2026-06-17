import { test, expect } from './fixtures'

const SERVER = 'http://localhost:3000'
const API = `${SERVER}/api`

async function criarKofrinhoUI(page: any, nome: string) {
  await page.click('button:has-text("Criar novo Kofrinho")')
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('input[id="nome"]', nome)
  await page.click('.modal-content button:has-text("Criar Kofrinho")')
  await expect(
    page.locator('.kofrinho-card').filter({ hasText: nome })
  ).toBeVisible({ timeout: 8000 })
}

// Busca o ID do kofrinho via API usando o token do localStorage (sem navegar de página)
async function getKofrinhoId(page: any, nome: string): Promise<number> {
  const id = await page.evaluate(
    async ({ api, nome }: any) => {
      const stored = localStorage.getItem('authTokens')
      const tokens = stored ? JSON.parse(stored) : null
      const res = await fetch(`${api}/kofrinhos`, {
        headers: { Authorization: `Bearer ${tokens?.token ?? ''}` },
      })
      const data = await res.json()
      const k = (data.kofrinhos as any[]).find((k) => k.nome === nome)
      return k?.id ?? null
    },
    { api: API, nome }
  )
  expect(id).not.toBeNull()
  return id as number
}

// Cria depositante via fetch no contexto do browser
async function criarDepositante(page: any, kofrinhoId: number, nome: string, valor: number) {
  const result = await page.evaluate(
    async ({ api, kofrinhoId, nome, valor }: any) => {
      const stored = localStorage.getItem('authTokens')
      const tokens = stored ? JSON.parse(stored) : null
      const res = await fetch(`${api}/kofrinhos/${kofrinhoId}/depositantes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.token ?? ''}`,
        },
        body: JSON.stringify({ nome, valor, recorrencia: 'mensal', email: `${nome.toLowerCase().replace(/\s+/g, '.')}@teste.com` }),
      })
      const body = await res.json()
      return { status: res.status, body }
    },
    { api: API, kofrinhoId, nome, valor }
  )
  expect(result.status).toBe(201)
  expect(result.body.depositante).toBeDefined()
  return result.body.depositante
}

// Cria pagamento pendente (pago=0) via rota de teste
async function criarPagamentoPendente(
  page: any,
  pagamentoId: string,
  kofrinhoId: number,
  depositanteId: number,
  valor: number
) {
  const result = await page.evaluate(
    async ({ server, pagamentoId, kofrinhoId, depositanteId, valor }: any) => {
      const res = await fetch(`${server}/test/pagamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagamento_id: pagamentoId, kofrinho_id: kofrinhoId, depositante_id: depositanteId, valor }),
      })
      return { status: res.status }
    },
    { server: SERVER, pagamentoId, kofrinhoId, depositanteId, valor }
  )
  expect(result.status).toBe(201)
}

// Confirma pagamento via webhook público (POST /api/pagamentos/:pagamentoId)
async function confirmarPagamento(page: any, pagamentoId: string) {
  const result = await page.evaluate(
    async ({ api, pagamentoId }: any) => {
      const res = await fetch(`${api}/pagamentos/${pagamentoId}`, { method: 'POST' })
      return { status: res.status }
    },
    { api: API, pagamentoId }
  )
  expect(result.status).toBe(200)
}

test.describe('Depósitos Confirmados', () => {
  test('exibe a seção "Depósitos Confirmados" na página de detalhes', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })

    await expect(page.locator('h2:has-text("Depósitos Confirmados")')).toBeVisible()
  })

  test('exibe mensagem de vazio quando não há depósitos confirmados', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })

    await expect(page.locator('text=Nenhum depósito confirmado ainda.')).toBeVisible()
  })

  test('não exibe pagamentos com pago=false no container Depósitos Confirmados', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    // Obtém ID via API sem navegar para a página de detalhes
    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Depositante Não Confirmado', 500)

    const pagamentoId = `e2e-nao-confirmado-${Date.now()}`
    await criarPagamentoPendente(page, pagamentoId, kofrinhoId, depositante.id, 500)

    // Navega para detalhes — fetchPagamentos filtra pago=0
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=Nenhum depósito confirmado ainda.')).toBeVisible()
    await expect(page.locator('.pagamentos-table')).not.toBeVisible()
  })

  test('exibe pagamento confirmado após receber webhook', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'João Confirmado', 750)

    const pagamentoId = `e2e-confirmado-${Date.now()}`
    await criarPagamentoPendente(page, pagamentoId, kofrinhoId, depositante.id, 750)
    await confirmarPagamento(page, pagamentoId)

    // Navega para detalhes — fetchPagamentos retorna pago=1
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.pagamentos-table')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.pagamentos-table tbody').locator('text=João Confirmado')).toBeVisible()
    await expect(page.locator('.pagamentos-table tbody').locator('text=R$ 750,00')).toBeVisible()
    await expect(page.locator('text=Nenhum depósito confirmado ainda.')).not.toBeVisible()
  })

  test('tabela tem colunas Depositante, Valor e Data', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Maria', 100)

    const pagamentoId = `e2e-colunas-${Date.now()}`
    await criarPagamentoPendente(page, pagamentoId, kofrinhoId, depositante.id, 100)
    await confirmarPagamento(page, pagamentoId)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    const thead = page.locator('.pagamentos-table thead')
    await expect(thead.locator('text=Depositante')).toBeVisible()
    await expect(thead.locator('text=Valor')).toBeVisible()
    await expect(thead.locator('text=Data')).toBeVisible()
  })

  test('exibe data e hora do pagamento (pago_em) na linha da tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Carlos', 999)

    const pagamentoId = `e2e-pago-em-${Date.now()}`
    await criarPagamentoPendente(page, pagamentoId, kofrinhoId, depositante.id, 999)

    const dataAntes = new Date()
    await confirmarPagamento(page, pagamentoId)
    const dataDepois = new Date()

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.pagamentos-table')).toBeVisible({ timeout: 8000 })

    // Verifica que a célula de data exibe um valor formatado (não "—")
    const celulaData = page.locator('.pagamentos-table tbody tr').first().locator('td').nth(2)
    const textoData = await celulaData.innerText()
    expect(textoData).not.toBe('—')
    expect(textoData.length).toBeGreaterThan(5)

    // Verifica que a data exibida é razoável (ano atual ou próximo)
    const anoAtual = dataAntes.getFullYear()
    expect(textoData).toContain(String(anoAtual))
  })
})
