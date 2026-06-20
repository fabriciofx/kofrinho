import { test, expect } from './fixtures'

// Abre o modal "Criar novo Kofrinho", preenche e cria; aguarda o card aparecer.
async function criarKofrinho(page: any, nome: string, descricao?: string) {
  await page.click('button:has-text("Criar novo Kofrinho")')
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('.modal-content input[id="nome"]', nome)
  if (descricao) await page.fill('.modal-content textarea[id="descricao"]', descricao)
  await page.click('.modal-content button:has-text("Criar Kofrinho")')
  await expect(
    page.locator('.kofrinho-card').filter({ hasText: nome })
  ).toBeVisible({ timeout: 8000 })
}

test.describe('Kofrinho CRUD Operations', () => {
  test('cria um novo kofrinho via modal', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Meu Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome, 'Um kofrinho para poupar')

    await expect(page.locator('.kofrinho-card').filter({ hasText: nome })).toBeVisible()
  })

  test('lista todos os kofrinhos criados', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome1 = `Kofrinho 1 ${Date.now()}`
    const nome2 = `Kofrinho 2 ${Date.now()}`
    await criarKofrinho(page, nome1, 'Primeiro')
    await criarKofrinho(page, nome2, 'Segundo')

    await expect(page.locator('.kofrinho-card').filter({ hasText: nome1 })).toBeVisible()
    await expect(page.locator('.kofrinho-card').filter({ hasText: nome2 })).toBeVisible()
  })

  test('abre os detalhes do kofrinho', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Detalhes ${Date.now()}`
    const desc = 'Descrição de teste'
    await criarKofrinho(page, nome, desc)

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Ver Detalhes")').click()
    await page.waitForURL(/\/kofrinho\/\d+/, { timeout: 8000 })

    // O container "Informações do Kofrinho" foi removido; a página exibe o nome como título
    await expect(page.locator('.kofrinho-details-title h1')).toHaveText(nome, { timeout: 10000 })
    await expect(page.locator('.kofrinho-details-title')).toContainText(desc)
  })

  test('edita um kofrinho pelo ícone no card', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Original ${Date.now()}`
    const novoNome = `Atualizado ${Date.now()}`
    await criarKofrinho(page, nome, 'Descrição original')

    // Clica no ícone de editar do card
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('.btn-icon-edit-card').click()
    await page.waitForSelector('.modal-content', { timeout: 5000 })
    await expect(page.locator('.modal-content h2:has-text("Editar Kofrinho")')).toBeVisible()

    await page.fill('.modal-content input[id="edit-kofrinho-nome"]', novoNome)
    await page.fill('.modal-content textarea[id="edit-kofrinho-descricao"]', 'Descrição nova')
    await page.click('.modal-content button:has-text("Salvar Alterações")')

    // O card reflete o novo nome e o antigo some
    await expect(page.locator('.kofrinho-card').filter({ hasText: novoNome })).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.kofrinho-card').filter({ hasText: nome })).toHaveCount(0)
  })

  test('deleta um kofrinho pelo card', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Para Deletar ${Date.now()}`
    await criarKofrinho(page, nome, 'Será deletado')

    page.once('dialog', (dialog: any) => dialog.accept())
    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('button:has-text("Deletar")').click()

    await expect(page.locator('.kofrinho-card').filter({ hasText: nome })).toHaveCount(0, { timeout: 8000 })
  })

  test('não cria kofrinho com nome vazio', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    await page.click('button:has-text("Criar novo Kofrinho")')
    await page.waitForSelector('.modal-content', { timeout: 5000 })

    // Deixa o nome vazio e tenta submeter — campo required impede o envio
    await page.fill('.modal-content textarea[id="descricao"]', 'Apenas descrição')
    await page.click('.modal-content button:has-text("Criar Kofrinho")')

    // O modal continua aberto (não houve criação)
    await expect(page.locator('.modal-content input[id="nome"]')).toBeVisible()
    const nomeInvalido = await page.locator('.modal-content input[id="nome"]')
      .evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(nomeInvalido).toBe(true)
  })

  test('cancela a edição fechando o modal sem salvar', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Imutável ${Date.now()}`
    await criarKofrinho(page, nome, 'Descrição original')

    await page.locator('.kofrinho-card').filter({ hasText: nome })
      .locator('.btn-icon-edit-card').click()
    await page.waitForSelector('.modal-content', { timeout: 5000 })

    // Altera os campos mas fecha pelo X em vez de salvar
    await page.fill('.modal-content input[id="edit-kofrinho-nome"]', 'Não deve persistir')
    await page.click('.modal-close-btn')
    await expect(page.locator('.modal-content')).toBeHidden({ timeout: 3000 })

    // O card mantém o nome original
    await expect(page.locator('.kofrinho-card').filter({ hasText: nome })).toBeVisible()
    await expect(page.locator('.kofrinho-card').filter({ hasText: 'Não deve persistir' })).toHaveCount(0)
  })
})
