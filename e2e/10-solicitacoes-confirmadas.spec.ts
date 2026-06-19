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

// Cria solicitação pendente (pago=0) via rota de teste
async function criarSolicitacaoPendente(
  page: any,
  solicitacaoId: string,
  kofrinhoId: number,
  depositanteId: number,
  valor: number
) {
  const result = await page.evaluate(
    async ({ server, solicitacaoId, kofrinhoId, depositanteId, valor }: any) => {
      const res = await fetch(`${server}/test/solicitacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitacao_id: solicitacaoId, kofrinho_id: kofrinhoId, depositante_id: depositanteId, valor }),
      })
      return { status: res.status }
    },
    { server: SERVER, solicitacaoId, kofrinhoId, depositanteId, valor }
  )
  expect(result.status).toBe(201)
}

// Confirma solicitação via webhook público (POST /api/solicitacoes/:solicitacaoId)
async function confirmarSolicitacao(page: any, solicitacaoId: string) {
  const result = await page.evaluate(
    async ({ api, solicitacaoId }: any) => {
      const res = await fetch(`${api}/solicitacoes/${solicitacaoId}`, { method: 'POST' })
      return { status: res.status }
    },
    { api: API, solicitacaoId }
  )
  expect(result.status).toBe(200)
}

test.describe('Solicitações', () => {
  test('exibe a seção "Solicitações" na página de detalhes', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })

    await expect(page.locator('h2:has-text("Solicitações")')).toBeVisible()
  })

  test('exibe mensagem de vazio quando não há solicitações cadastradas', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })

    await expect(page.locator('text=Nenhuma solicitação cadastrada ainda.')).toBeVisible()
  })

  test('não exibe solicitações com pago=false no container Solicitações', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    // Obtém ID via API sem navegar para a página de detalhes
    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Depositante Não Confirmado', 500)

    const solicitacaoId = `e2e-nao-confirmado-${Date.now()}`
    await criarSolicitacaoPendente(page, solicitacaoId, kofrinhoId, depositante.id, 500)

    // Navega para detalhes — fetchSolicitacoes filtra pago=0
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=Nenhuma solicitação cadastrada ainda.')).toBeVisible()
    await expect(page.locator('.solicitacoes-table')).not.toBeVisible()
  })

  test('exibe solicitação confirmada após receber webhook', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'João Confirmado', 750)

    const solicitacaoId = `e2e-confirmado-${Date.now()}`
    await criarSolicitacaoPendente(page, solicitacaoId, kofrinhoId, depositante.id, 750)
    await confirmarSolicitacao(page, solicitacaoId)

    // Navega para detalhes — fetchSolicitacoes retorna pago=1
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.solicitacoes-table')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.solicitacoes-table tbody').locator('text=João Confirmado')).toBeVisible()
    await expect(page.locator('.solicitacoes-table tbody').locator('text=R$ 750,00')).toBeVisible()
    await expect(page.locator('text=Nenhuma solicitação cadastrada ainda.')).not.toBeVisible()
  })

  test('tabela tem colunas Depositante, Valor e Data', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Maria', 100)

    const solicitacaoId = `e2e-colunas-${Date.now()}`
    await criarSolicitacaoPendente(page, solicitacaoId, kofrinhoId, depositante.id, 100)
    await confirmarSolicitacao(page, solicitacaoId)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    const thead = page.locator('.solicitacoes-table thead')
    await expect(thead.locator('text=Depositante')).toBeVisible()
    await expect(thead.locator('text=Valor')).toBeVisible()
    await expect(thead.locator('text=Data')).toBeVisible()
  })

  test('atualiza tabela automaticamente via SSE quando solicitação é confirmada', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'SSE Depositante', 300)

    const solicitacaoId = `e2e-sse-${Date.now()}`
    await criarSolicitacaoPendente(page, solicitacaoId, kofrinhoId, depositante.id, 300)

    // Navega para a página de detalhes (inicia conexão SSE)
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    // Confirma que ainda não há solicitações confirmadas
    await expect(page.locator('text=Nenhuma solicitação cadastrada ainda.')).toBeVisible()

    // Confirma a solicitação via webhook (simula chamada da Confrapix)
    await confirmarSolicitacao(page, solicitacaoId)

    // A tabela deve atualizar automaticamente via SSE sem reload da página
    await expect(page.locator('.solicitacoes-table')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.solicitacoes-table tbody').locator('text=SSE Depositante')).toBeVisible()
    await expect(page.locator('text=Nenhuma solicitação cadastrada ainda.')).not.toBeVisible()
  })

  test('exibe data e hora da solicitação (pago_em) na linha da tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Carlos', 999)

    const solicitacaoId = `e2e-pago-em-${Date.now()}`
    await criarSolicitacaoPendente(page, solicitacaoId, kofrinhoId, depositante.id, 999)

    const dataAntes = new Date()
    await confirmarSolicitacao(page, solicitacaoId)
    const dataDepois = new Date()

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.solicitacoes-table')).toBeVisible({ timeout: 8000 })

    // Verifica que a célula de data exibe um valor formatado (não "—")
    const celulaData = page.locator('.solicitacoes-table tbody tr').first().locator('td').nth(2)
    const textoData = await celulaData.innerText()
    expect(textoData).not.toBe('—')
    expect(textoData.length).toBeGreaterThan(5)

    // Verifica que a data exibida é razoável (ano atual ou próximo)
    const anoAtual = dataAntes.getFullYear()
    expect(textoData).toContain(String(anoAtual))
  })
})
