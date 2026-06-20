import { test, expect } from './fixtures'

async function criarKofrinhoENavegar(page: any, nome: string) {
  await page.waitForLoadState('networkidle')
  await page.click('button:has-text("Criar novo Kofrinho")')
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('input[id="nome"]', nome)
  await page.click('.modal-content button:has-text("Criar Kofrinho")')
  await expect(page.locator('.kofrinho-card').filter({ hasText: nome })).toBeVisible({ timeout: 8000 })
  await page.locator('.kofrinho-card').filter({ hasText: nome })
    .locator('button:has-text("Ver Detalhes")').click()
  await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
}

test.describe('Botão Novo Depositante', () => {
  test('página de detalhes carrega sem erro após adicionar botão Novo Depositante', async ({ authenticatedPage: page }) => {
    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoENavegar(page, nome)

    // A página deve exibir o título e as seções principais sem crash
    await expect(page.locator('.kofrinho-details-title h1')).toHaveText(nome)
    await expect(page.locator('h2:has-text("Depositantes")')).toBeVisible()
    await expect(page.locator('h2:has-text("Solicitações")')).toBeVisible()

    // Não deve haver mensagem de erro na tela
    await expect(page.locator('text=Erro ao carregar Kofrinho')).not.toBeVisible()
    await expect(page.locator('text=Failed to fetch')).not.toBeVisible()
  })

  test('botão "Novo depositante" é visível na seção Depositantes', async ({ authenticatedPage: page }) => {
    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoENavegar(page, nome)

    await expect(page.locator('button:has-text("Novo depositante")')).toBeVisible()
  })

  test('clicar em "Novo depositante" abre o modal de criação', async ({ authenticatedPage: page }) => {
    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoENavegar(page, nome)

    await page.click('button:has-text("Novo depositante")')

    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-content h2:has-text("Novo Depositante")')).toBeVisible()
  })

  test('modal contém os campos do formulário de depositante', async ({ authenticatedPage: page }) => {
    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoENavegar(page, nome)

    await page.click('button:has-text("Novo depositante")')
    await page.waitForSelector('.modal-content', { timeout: 5000 })

    await expect(page.locator('#depositante-nome')).toBeVisible()
    await expect(page.locator('#depositante-valor')).toBeVisible()
    await expect(page.locator('#depositante-recorrencia')).toBeVisible()
    await expect(page.locator('#depositante-email')).toBeVisible()
  })

  test('fechar o modal não causa erro na página', async ({ authenticatedPage: page }) => {
    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoENavegar(page, nome)

    await page.click('button:has-text("Novo depositante")')
    await page.waitForSelector('.modal-content', { timeout: 5000 })

    // Fecha pelo botão X
    await page.click('.modal-close-btn')
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })

    // Página continua funcional
    await expect(page.locator('h2:has-text("Depositantes")')).toBeVisible()
  })

  test('criar depositante via modal atualiza a lista', async ({ authenticatedPage: page }) => {
    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinhoENavegar(page, nome)

    await page.click('button:has-text("Novo depositante")')
    await page.waitForSelector('.modal-content', { timeout: 5000 })

    await page.fill('#depositante-nome', 'Ana Souza')
    await page.fill('#depositante-valor', '250')
    await page.fill('#depositante-email', 'ana@teste.com')

    await page.click('.modal-content button:has-text("Criar Depositante")')

    // Modal fecha e depositante aparece na tabela
    await expect(page.locator('.modal-content')).toBeHidden({ timeout: 8000 })
    await expect(page.locator('.depositantes-table tbody').locator('text=Ana Souza')).toBeVisible({ timeout: 8000 })
  })
})
