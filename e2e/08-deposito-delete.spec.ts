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

async function criarDeposito(page: any, kofrinhoNome: string, depositoNome: string, valor: string) {
  await page.locator('.kofrinho-card').filter({ hasText: kofrinhoNome })
    .locator('button:has-text("Criar Depósito")').click()
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('input[id="deposito-nome"]', depositoNome)
  await page.fill('input[id="deposito-valor"]', valor)
  await page.locator('.modal-content button[type="submit"]').click()
  await expect(page.locator('text=Depósito criado com sucesso')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
}

async function irParaDetalhes(page: any, kofrinhoNome: string) {
  await page.locator('.kofrinho-card').filter({ hasText: kofrinhoNome })
    .locator('button:has-text("Ver Detalhes")').click()
  await expect(page).toHaveURL(/\/kofrinho\/\d+/, { timeout: 5000 })
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.depositos-table')).toBeVisible({ timeout: 8000 })
}

test.describe('Deletar Depósito', () => {
  test('deve exibir ícone de lixeira em cada linha da tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDeposito(page, nome, 'Depósito A', '100')
    await irParaDetalhes(page, nome)

    const lixeira = page.locator('.depositos-table tbody tr').first().locator('.btn-delete-deposito')
    await expect(lixeira).toBeVisible()
    await expect(lixeira).toHaveAttribute('title', 'Remover depósito')
  })

  test('deve remover o depósito da tabela ao confirmar a exclusão', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDeposito(page, nome, 'Salário', '3000')
    await irParaDetalhes(page, nome)

    await expect(page.locator('.depositos-table tbody tr').filter({ hasText: 'Salário' })).toBeVisible()

    // Confirmar dialog de exclusão
    page.once('dialog', dialog => dialog.accept())
    await page.locator('.depositos-table tbody tr').filter({ hasText: 'Salário' })
      .locator('.btn-delete-deposito').click()

    // Depósito deve desaparecer da tabela
    await expect(page.locator('.depositos-table tbody tr').filter({ hasText: 'Salário' }))
      .not.toBeVisible({ timeout: 5000 })
  })

  test('deve mostrar estado vazio após remover o único depósito', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDeposito(page, nome, 'Único', '50')
    await irParaDetalhes(page, nome)

    page.once('dialog', dialog => dialog.accept())
    await page.locator('.btn-delete-deposito').first().click()

    await expect(page.locator('text=Nenhum depósito cadastrado ainda')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.depositos-table')).not.toBeVisible()
  })

  test('não deve remover o depósito ao cancelar o dialog', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDeposito(page, nome, 'Permanente', '200')
    await irParaDetalhes(page, nome)

    // Rejeitar o dialog (cancelar)
    page.once('dialog', dialog => dialog.dismiss())
    await page.locator('.btn-delete-deposito').first().click()

    // Depósito deve continuar na tabela
    await expect(page.locator('.depositos-table tbody tr').filter({ hasText: 'Permanente' })).toBeVisible()
  })

  test('deve remover apenas o depósito correto quando há múltiplos', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDeposito(page, nome, 'Manter Este', '100')
    await criarDeposito(page, nome, 'Apagar Este', '999')
    await irParaDetalhes(page, nome)

    await expect(page.locator('.depositos-table tbody tr')).toHaveCount(2, { timeout: 5000 })

    page.once('dialog', dialog => dialog.accept())
    await page.locator('.depositos-table tbody tr').filter({ hasText: 'Apagar Este' })
      .locator('.btn-delete-deposito').click()

    await expect(page.locator('.depositos-table tbody tr').filter({ hasText: 'Apagar Este' }))
      .not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.depositos-table tbody tr').filter({ hasText: 'Manter Este' })).toBeVisible()
    await expect(page.locator('.depositos-table tbody tr')).toHaveCount(1)
  })

  test('depósito removido não deve reaparecer ao recarregar a página de detalhes', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDeposito(page, nome, 'Efêmero', '77')
    await irParaDetalhes(page, nome)

    page.once('dialog', dialog => dialog.accept())
    await page.locator('.btn-delete-deposito').first().click()
    await expect(page.locator('text=Nenhum depósito cadastrado ainda')).toBeVisible({ timeout: 5000 })

    // Voltar ao dashboard e entrar em detalhes novamente
    await page.click('.btn-back')
    await page.waitForLoadState('networkidle')
    await irParaDetalhes(page, nome)

    await expect(page.locator('text=Nenhum depósito cadastrado ainda')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.depositos-table')).not.toBeVisible()
  })
})
