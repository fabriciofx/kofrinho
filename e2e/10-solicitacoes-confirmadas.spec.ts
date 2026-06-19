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

// Cria depositante via rota de teste (SEM agendamento), para que o scheduler
// não gere solicitações automáticas e as asserções permaneçam determinísticas.
async function criarDepositante(page: any, kofrinhoId: number, nome: string, valor: number) {
  const result = await page.evaluate(
    async ({ server, kofrinhoId, nome, valor }: any) => {
      const res = await fetch(`${server}/test/depositantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kofrinho_id: kofrinhoId,
          nome,
          valor,
          recorrencia: 'mensal',
          email: `${nome.toLowerCase().replace(/\s+/g, '.')}@teste.com`,
        }),
      })
      const body = await res.json()
      return { status: res.status, body }
    },
    { server: SERVER, kofrinhoId, nome, valor }
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

  test('exibe solicitação a pagar (pago=0) com situação "A Pagar"', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    // Obtém ID via API sem navegar para a página de detalhes
    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Depositante Pendente', 500)

    const solicitacaoId = `e2e-a-pagar-${Date.now()}`
    await criarSolicitacaoPendente(page, solicitacaoId, kofrinhoId, depositante.id, 500)

    // Navega para detalhes — a solicitação enviada aparece mesmo sem pagamento
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    const linha = page.locator('.solicitacoes-table tbody tr').filter({ hasText: 'Depositante Pendente' })
    await expect(linha).toBeVisible({ timeout: 8000 })
    await expect(linha.locator('.situacao-badge')).toHaveText('A Pagar')
    await expect(page.locator('text=Nenhuma solicitação cadastrada ainda.')).not.toBeVisible()
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
    const linha = page.locator('.solicitacoes-table tbody tr').filter({ hasText: 'João Confirmado' })
    await expect(linha).toBeVisible()
    await expect(linha.locator('text=R$ 750,00')).toBeVisible()
    await expect(linha.locator('.situacao-badge')).toHaveText('Paga')
    await expect(page.locator('text=Nenhuma solicitação cadastrada ainda.')).not.toBeVisible()
  })

  test('tabela tem colunas Depositante, Valor, Data e Situação', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Maria', 100)

    const solicitacaoId = `e2e-colunas-${Date.now()}`
    await criarSolicitacaoPendente(page, solicitacaoId, kofrinhoId, depositante.id, 100)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    const thead = page.locator('.solicitacoes-table thead')
    await expect(thead.locator('text=Depositante')).toBeVisible()
    await expect(thead.locator('text=Valor')).toBeVisible()
    await expect(thead.locator('text=Data')).toBeVisible()
    await expect(thead.locator('text=Situação')).toBeVisible()
  })

  test('situação muda de "A Pagar" para "Paga" ao vivo (via SSE) após chamada à API', async ({ authenticatedPage: page }) => {
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

    // A solicitação já aparece como "A Pagar" antes do pagamento
    const linha = page.locator('.solicitacoes-table tbody tr').filter({ hasText: 'SSE Depositante' })
    await expect(linha).toBeVisible({ timeout: 8000 })
    await expect(linha.locator('.situacao-badge')).toHaveText('A Pagar')

    // Confirma o pagamento via webhook (simula chamada da Confrapix)
    await confirmarSolicitacao(page, solicitacaoId)

    // A situação deve mudar para "Paga" automaticamente, sem reload da página
    await expect(linha.locator('.situacao-badge')).toHaveText('Paga', { timeout: 8000 })
  })

  test('exibe a data e hora de envio (criado_em) na linha da tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoUI(page, nome)

    const kofrinhoId = await getKofrinhoId(page, nome)
    const depositante = await criarDepositante(page, kofrinhoId, 'Carlos', 999)

    const solicitacaoId = `e2e-criado-em-${Date.now()}`
    const dataAntes = new Date()
    await criarSolicitacaoPendente(page, solicitacaoId, kofrinhoId, depositante.id, 999)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.solicitacoes-table')).toBeVisible({ timeout: 8000 })

    // A coluna Data (índice 2) exibe a data de envio mesmo com a solicitação "A Pagar"
    const celulaData = page.locator('.solicitacoes-table tbody tr').first().locator('td').nth(2)
    const textoData = await celulaData.innerText()
    expect(textoData).not.toBe('—')
    expect(textoData.length).toBeGreaterThan(5)

    // Verifica que a data exibida é razoável (ano atual)
    const anoAtual = dataAntes.getFullYear()
    expect(textoData).toContain(String(anoAtual))
  })
})
