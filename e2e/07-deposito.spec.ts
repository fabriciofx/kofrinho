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

async function abrirModalDeposito(page: any, kofrinhoNome: string) {
  await page.locator('.kofrinho-card').filter({ hasText: kofrinhoNome })
    .locator('button:has-text("Criar Depósito")').click()
  await page.waitForSelector('.modal-content', { timeout: 5000 })
}

test.describe('Criar Depósito', () => {
  test('deve abrir o modal ao clicar em "Criar Depósito" no card', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    await expect(page.locator('.modal-header h2')).toHaveText('Criar Depósito')
    await expect(page.locator('input[id="deposito-nome"]')).toBeVisible()
    await expect(page.locator('input[id="deposito-valor"]')).toBeVisible()
    await expect(page.locator('select[id="deposito-recorrencia"]')).toBeVisible()
  })

  test('deve exibir as quatro opções de recorrência no combobox', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    const opcoes = await page.locator('select[id="deposito-recorrencia"] option').allTextContents()
    expect(opcoes).toContain('Diário')
    expect(opcoes).toContain('Semanal')
    expect(opcoes).toContain('Mensal')
    expect(opcoes).toContain('Anual')
  })

  test('deve criar depósito e exibir mensagem de sucesso', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    await page.fill('input[id="deposito-nome"]', 'Aporte Mensal')
    await page.fill('input[id="deposito-valor"]', '500')
    await page.selectOption('select[id="deposito-recorrencia"]', 'mensal')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depósito criado com sucesso')).toBeVisible({ timeout: 8000 })
  })

  test('deve fechar o modal após o sucesso da criação', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    await page.fill('input[id="deposito-nome"]', 'Bônus')
    await page.fill('input[id="deposito-valor"]', '200')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depósito criado com sucesso')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
  })

  test('deve fechar o modal ao clicar no botão X', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    await page.click('.modal-close-btn')
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })
  })

  test('deve mostrar o depósito na tabela da página de detalhes', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    await page.fill('input[id="deposito-nome"]', 'Salário')
    await page.fill('input[id="deposito-valor"]', '3000')
    await page.selectOption('select[id="deposito-recorrencia"]', 'mensal')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depósito criado com sucesso')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await expect(page).toHaveURL(/\/kofrinho\/\d+/, { timeout: 5000 })
    await page.waitForLoadState('networkidle')

    const row = page.locator('.depositos-table tbody tr').filter({ hasText: 'Salário' })
    await expect(row).toBeVisible({ timeout: 8000 })
    await expect(row.locator('td').nth(0)).toHaveText('Salário')
    await expect(row.locator('td').nth(1)).toContainText('3.000')
    await expect(row.locator('td').nth(2)).toHaveText('Mensal')
  })

  test('deve formatar o valor em reais (R$) na tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    await page.fill('input[id="deposito-nome"]', 'Investimento')
    await page.fill('input[id="deposito-valor"]', '1500.50')
    await page.selectOption('select[id="deposito-recorrencia"]', 'anual')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForLoadState('networkidle')

    const row = page.locator('.depositos-table tbody tr').filter({ hasText: 'Investimento' })
    await expect(row.locator('td').nth(1)).toContainText('R$')
    await expect(row.locator('td').nth(1)).toContainText('1.500')
    await expect(row.locator('td').nth(2)).toHaveText('Anual')
  })

  test('deve exibir múltiplos depósitos na tabela ordenados por criação', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)

    const depositos = [
      { nome: 'Depósito Diário', valor: '10', recorrencia: 'diario', label: 'Diário' },
      { nome: 'Depósito Semanal', valor: '70', recorrencia: 'semanal', label: 'Semanal' },
      { nome: 'Depósito Anual', valor: '1200', recorrencia: 'anual', label: 'Anual' },
    ]

    for (const dep of depositos) {
      await abrirModalDeposito(page, nome)
      await page.fill('input[id="deposito-nome"]', dep.nome)
      await page.fill('input[id="deposito-valor"]', dep.valor)
      await page.selectOption('select[id="deposito-recorrencia"]', dep.recorrencia)
      await page.locator('.modal-content button[type="submit"]').click()
      await expect(page.locator('text=Depósito criado com sucesso')).toBeVisible({ timeout: 8000 })
      await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
    }

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.depositos-table')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.depositos-table tbody tr')).toHaveCount(3, { timeout: 5000 })

    for (const dep of depositos) {
      await expect(
        page.locator('.depositos-table tbody tr').filter({ hasText: dep.nome })
      ).toBeVisible()
    }
  })

  test('deve exibir estado vazio quando não há depósitos', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await expect(page).toHaveURL(/\/kofrinho\/\d+/, { timeout: 5000 })
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=Nenhum depósito cadastrado ainda')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.depositos-table')).not.toBeVisible()
  })

  test('não deve criar depósito sem nome (validação do browser)', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    await page.fill('input[id="deposito-valor"]', '100')
    await page.locator('.modal-content button[type="submit"]').click()

    // Modal permanece aberto (validação HTML5 bloqueia o submit)
    await expect(page.locator('.modal-content')).toBeVisible()
    await expect(page.locator('text=Depósito criado com sucesso')).not.toBeVisible()
  })

  test('não deve criar depósito sem valor (validação do browser)', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await abrirModalDeposito(page, nome)

    await page.fill('input[id="deposito-nome"]', 'Teste')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('.modal-content')).toBeVisible()
    await expect(page.locator('text=Depósito criado com sucesso')).not.toBeVisible()
  })
})
