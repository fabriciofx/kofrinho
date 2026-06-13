import { test, expect } from './fixtures'

test.describe('Kofrinho Details', () => {
  test('should load kofrinho details page without "Failed to fetch" error', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    // Open the create modal
    await page.click('button:has-text("Criar novo Kofrinho")')
    await page.waitForSelector('.modal-content', { timeout: 5000 })

    const kofrinhoName = `Teste Detalhes ${Date.now()}`
    const kofrinhoDesc = 'Descrição para verificar carregamento'

    await page.fill('input[id="nome"]', kofrinhoName)
    await page.fill('textarea[id="descricao"]', kofrinhoDesc)
    await page.click('button:has-text("Criar Kofrinho")')

    // Wait for the new kofrinho card to appear in the dashboard
    await expect(
      page.locator('.kofrinho-card').filter({ hasText: kofrinhoName })
    ).toBeVisible({ timeout: 8000 })

    // Click "Ver Detalhes" on the newly created card
    await page
      .locator('.kofrinho-card')
      .filter({ hasText: kofrinhoName })
      .locator('button:has-text("Ver Detalhes")')
      .click()

    // Verify navigation to the details page
    await expect(page).toHaveURL(/\/kofrinho\/\d+/, { timeout: 5000 })

    // Wait for API response
    await page.waitForLoadState('networkidle')

    // Verify the details card is shown with correct data
    await expect(page.locator('h2:has-text("Informações do Kofrinho")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.info-group').filter({ hasText: kofrinhoName })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.info-group').filter({ hasText: kofrinhoDesc })).toBeVisible({ timeout: 5000 })

    // Verify that no error messages are shown
    await expect(page.locator('text=Erro ao carregar Kofrinho')).not.toBeVisible()
    await expect(page.locator('text=Failed to fetch')).not.toBeVisible()
  })
})
