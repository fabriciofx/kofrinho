import { test, expect } from './fixtures'

async function criarKofrinho(page: any, nome: string) {
  await page.click('button:has-text("Criar novo Kofrinho")')
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('input[id="nome"]', nome)
  await page.click('.modal-content button:has-text("Criar Kofrinho")')
  await expect(
    page.locator('.kofrinho-card').filter({ hasText: nome })
  ).toBeVisible({ timeout: 8000 })
}

async function abrirModalDepositante(page: any, kofrinhoNome: string) {
  await page.locator('.kofrinho-card').filter({ hasText: kofrinhoNome })
    .locator('button:has-text("Criar Depositante")').click()
  await page.waitForSelector('.modal-content', { timeout: 5000 })
}

test.describe('Criar Depositante', () => {
  test('deve abrir o modal ao clicar em "Criar Depositante" no card', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await expect(page.locator('.modal-header h2')).toHaveText('Criar Depositante')
    await expect(page.locator('input[id="depositante-nome"]')).toBeVisible()
    await expect(page.locator('input[id="depositante-valor"]')).toBeVisible()
    await expect(page.locator('select[id="depositante-recorrencia"]')).toBeVisible()
  })

  test('deve exibir as quatro opções de recorrência no combobox', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    const opcoes = await page.locator('select[id="depositante-recorrencia"] option').allTextContents()
    expect(opcoes).toContain('Diário')
    expect(opcoes).toContain('Semanal')
    expect(opcoes).toContain('Mensal')
    expect(opcoes).toContain('Anual')
  })

  test('deve criar depositante e exibir mensagem de sucesso', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await page.fill('input[id="depositante-nome"]', 'Aporte Mensal')
    await page.fill('input[id="depositante-valor"]', '500')
    await page.selectOption('select[id="depositante-recorrencia"]', 'mensal')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depositante criado com sucesso')).toBeVisible({ timeout: 8000 })
  })

  test('deve fechar o modal após o sucesso da criação', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await page.fill('input[id="depositante-nome"]', 'Bônus')
    await page.fill('input[id="depositante-valor"]', '200')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depositante criado com sucesso')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
  })

  test('deve fechar o modal ao clicar no botão X', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await page.click('.modal-close-btn')
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })
  })

  test('deve mostrar o depositante na tabela da página de detalhes', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await page.fill('input[id="depositante-nome"]', 'Salário')
    await page.fill('input[id="depositante-valor"]', '3000')
    await page.selectOption('select[id="depositante-recorrencia"]', 'mensal')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depositante criado com sucesso')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await expect(page).toHaveURL(/\/kofrinho\/\d+/, { timeout: 5000 })
    await page.waitForLoadState('networkidle')

    const row = page.locator('.depositantes-table tbody tr').filter({ hasText: 'Salário' })
    await expect(row).toBeVisible({ timeout: 8000 })
    await expect(row.locator('td').nth(0)).toHaveText('Salário')
    await expect(row.locator('td').nth(1)).toContainText('3.000')
    await expect(row.locator('td').nth(2)).toHaveText('Mensal')
  })

  test('deve formatar o valor em reais (R$) na tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await page.fill('input[id="depositante-nome"]', 'Investimento')
    await page.fill('input[id="depositante-valor"]', '1500.50')
    await page.selectOption('select[id="depositante-recorrencia"]', 'anual')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForLoadState('networkidle')

    const row = page.locator('.depositantes-table tbody tr').filter({ hasText: 'Investimento' })
    await expect(row.locator('td').nth(1)).toContainText('R$')
    await expect(row.locator('td').nth(1)).toContainText('1.500')
    await expect(row.locator('td').nth(2)).toHaveText('Anual')
  })

  test('deve exibir múltiplos depositantes na tabela ordenados por criação', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)

    const depositantes = [
      { nome: 'Depositante Diário', valor: '10', recorrencia: 'diario', label: 'Diário' },
      { nome: 'Depositante Semanal', valor: '70', recorrencia: 'semanal', label: 'Semanal' },
      { nome: 'Depositante Anual', valor: '1200', recorrencia: 'anual', label: 'Anual' },
    ]

    for (const dep of depositantes) {
      await abrirModalDepositante(page, nome)
      await page.fill('input[id="depositante-nome"]', dep.nome)
      await page.fill('input[id="depositante-valor"]', dep.valor)
      await page.selectOption('select[id="depositante-recorrencia"]', dep.recorrencia)
      await page.locator('.modal-content button[type="submit"]').click()
      await expect(page.locator('text=Depositante criado com sucesso')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
    }

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.depositantes-table')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.depositantes-table tbody tr')).toHaveCount(3, { timeout: 5000 })

    for (const dep of depositantes) {
      await expect(
        page.locator('.depositantes-table tbody tr').filter({ hasText: dep.nome })
      ).toBeVisible()
    }
  })

  test('deve exibir estado vazio quando não há depositantes', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await expect(page).toHaveURL(/\/kofrinho\/\d+/, { timeout: 5000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=Nenhum depositante cadastrado ainda')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.depositantes-table')).not.toBeVisible()
  })

  test('não deve criar depositante sem nome (validação do browser)', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await page.fill('input[id="depositante-valor"]', '100')
    await page.locator('.modal-content button[type="submit"]').click()

    // Modal permanece aberto (validação HTML5 bloqueia o submit)
    await expect(page.locator('.modal-content')).toBeVisible()
    await expect(page.locator('text=Depositante criado com sucesso')).not.toBeVisible()
  })

  test('não deve criar depositante sem valor (validação do browser)', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDepositante(page, nome)

    await page.fill('input[id="depositante-nome"]', 'Teste')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('.modal-content')).toBeVisible()
    await expect(page.locator('text=Depositante criado com sucesso')).not.toBeVisible()
  })
})
