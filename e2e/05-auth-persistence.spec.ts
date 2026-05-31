import { test, expect } from './fixtures'

test.describe('Authentication State Persistence', () => {
  test('should maintain login after page reload', async ({ page, testUser }) => {
    // Register
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Verify user is on dashboard
    await expect(page.locator(`text=Bem-vindo`)).toBeVisible()

    // Reload page
    await page.reload()

    // Verify user is still logged in
    await expect(page.locator(`text=Bem-vindo`)).toBeVisible()
  })

  test('should clear login on logout', async ({ page, testUser }) => {
    // Register and login
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Verify dashboard
    await expect(page.locator(`text=Bem-vindo`)).toBeVisible()

    // Logout
    await page.click('button:has-text("Sair")')

    // Verify we're back on login page
    await expect(page.locator('text=Login')).toBeVisible()
    await expect(page.locator('text=Bem-vindo')).not.toBeVisible()
  })

  test('should prevent unauthenticated access to kofrinho details', async ({ page }) => {
    // Try to access kofrinho details without authentication
    await page.goto('/kofrinho/1')

    // Should redirect to login
    await expect(page.locator('text=Login')).toBeVisible()
  })

  test('should maintain user data across app navigation', async ({ page, testUser }) => {
    // Register
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Verify user info on dashboard
    await expect(page.locator(`text=${testUser.name}`)).toBeVisible()

    // Create a kofrinho
    await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
    await page.fill('input[id="nome"]', 'Test Kofrinho')
    await page.fill('textarea[id="descricao"]', 'Test')
    await page.click('button:has-text("Criar Kofrinho")')
    await page.waitForTimeout(500)

    // Navigate to kofrinho details
    await page.click('button:has-text("Ver Detalhes")')
    await page.waitForURL(/\/kofrinho\/\d+/)

    // Verify user is still logged in on details page
    await expect(page.locator('text=Test Kofrinho')).toBeVisible()

    // Navigate back using button
    const backButton = page.locator('button.btn-back')
    if (await backButton.isVisible()) {
      await backButton.click()
    } else {
      await page.goto('/')
    }

    // Verify user is still logged in
    await expect(page.locator(`text=${testUser.name}`)).toBeVisible()
  })

  test('should handle logout during pending requests gracefully', async ({ page, testUser }) => {
    // Register
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Immediately logout
    await page.click('button:has-text("Sair")')

    // Verify successful logout
    await expect(page.locator('text=Login')).toBeVisible()

    // Try to access dashboard directly
    await page.goto('/')
    
    // Should still see login page
    await expect(page.locator('text=Login')).toBeVisible()
  })
})
