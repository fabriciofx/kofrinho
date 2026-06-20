import { test, expect } from './fixtures'

function hojeISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
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
  test('o formulário tem campo de data com o dia de hoje e botão "Hoje"', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    const dateInput = page.locator('input[id="depositante-data-inicio"]')
    await expect(dateInput).toBeVisible()
    await expect(dateInput).toHaveValue(hojeISO())

    // muda a data e o botão "Hoje" restaura para o dia de hoje
    await dateInput.fill('2099-12-31')
    await expect(dateInput).toHaveValue('2099-12-31')
    await page.locator('.modal-content button:has-text("Hoje")').click()
    await expect(dateInput).toHaveValue(hojeISO())
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
    // a data de início já vem preenchida com hoje
    await expect(page.locator('input[id="depositante-data-inicio"]')).toHaveValue(hojeISO())
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
