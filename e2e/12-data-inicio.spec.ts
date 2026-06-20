import { test, expect } from './fixtures'

function hojeISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Dia 20 do próximo mês (sempre no futuro, portanto habilitado no calendário)
function proximoMesDia20(): string {
  const d = new Date()
  let y = d.getFullYear()
  let m = d.getMonth() + 2 // próximo mês (1-based)
  if (m === 13) { m = 1; y++ }
  return `${y}-${String(m).padStart(2, '0')}-20`
}

async function criarKofrinho(page: any, nome: string) {
  await page.click('button:has-text("Criar novo Kofrinho")')
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('input[id="nome"]', nome)
  await page.click('.modal-content button:has-text("Criar Kofrinho")')
  await expect(page.locator('.kofrinho-card').filter({ hasText: nome })).toBeVisible({ timeout: 8000 })
}

async function abrirModalDepositante(page: any, kofrinhoNome: string) {
  await page.locator('.kofrinho-card').filter({ hasText: kofrinhoNome })
    .locator('button:has-text("Criar Depositante")').click()
  await page.waitForSelector('.modal-content', { timeout: 5000 })
}

test.describe('Data de início da recorrência', () => {
  test('o calendário começa com o dia de hoje, permite escolher um dia e o botão "Hoje" restaura', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    const cal = page.locator('#depositante-data-inicio')
    await expect(cal).toBeVisible()
    await expect(cal.locator('.calendar-grid')).toBeVisible() // é um calendário, não um campo de texto
    await expect(cal).toHaveAttribute('data-value', hojeISO())

    // navega para o próximo mês e escolhe o dia 20
    await cal.locator('button[aria-label="Próximo mês"]').click()
    await cal.locator('.calendar-day', { hasText: /^20$/ }).click()
    await expect(cal).toHaveAttribute('data-value', proximoMesDia20())

    // o botão "Hoje" volta a selecionar o dia de hoje
    await cal.locator('.calendar-hoje').click()
    await expect(cal).toHaveAttribute('data-value', hojeISO())
  })

  test('a dica de envio muda conforme a recorrência', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    const dica = page.locator('.data-inicio-hint')
    await page.selectOption('select[id="depositante-recorrencia"]', 'diario')
    await expect(dica).toContainText('diariamente')
    await page.selectOption('select[id="depositante-recorrencia"]', 'mensal')
    await expect(dica).toContainText('todo mês')
    await page.selectOption('select[id="depositante-recorrencia"]', 'anual')
    await expect(dica).toContainText('todo ano')
  })

  test('criar com a data de hoje envia a solicitação, que aparece em "Solicitações"', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await page.fill('input[id="depositante-nome"]', 'Envio Hoje')
    await page.fill('input[id="depositante-valor"]', '300')
    await page.selectOption('select[id="depositante-recorrencia"]', 'mensal')
    // a data de início já vem com hoje selecionado no calendário
    await expect(page.locator('#depositante-data-inicio')).toHaveAttribute('data-value', hojeISO())
    await page.fill('input[id="depositante-email"]', 'envio.hoje@teste.com')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depositante criado com sucesso')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })

    // abre os detalhes — o scheduler gera a solicitação a partir de hoje
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })

    // a solicitação enviada aparece (situação "A Pagar")
    const linha = page.locator('.solicitacoes-table tbody tr').filter({ hasText: 'Envio Hoje' }).first()
    await expect(linha).toBeVisible({ timeout: 15000 })
    await expect(linha.locator('.situacao-badge')).toHaveText('A Pagar')

    // limpeza: remove o depositante (cascateia agendamento + solicitações e para o scheduler)
    page.once('dialog', (d: any) => d.accept())
    await page.locator('.depositantes-table tbody tr').filter({ hasText: 'Envio Hoje' })
      .locator('.btn-delete-depositante').click()
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Envio Hoje' }))
      .toHaveCount(0, { timeout: 8000 })
  })
})
