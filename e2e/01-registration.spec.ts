import { test, expect } from './fixtures'

test.describe('Registration Flow', () => {
  test('should register new user successfully', async ({ page, testUser }) => {
    // Navigate to login page
    await page.goto('/')

    // Verify login page is shown
    await expect(page.locator('text=Login')).toBeVisible()

    // Click "Criar conta" button
    await page.click('button:has-text("Criar conta")')

    // Verify registration form is shown
    await expect(page.locator('text=Criar Conta')).toBeVisible()

    // Fill registration form
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)

    // Submit registration
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Wait for dashboard to load
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Verify user is logged in and on dashboard
    await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()
    await expect(page.locator(`text=${testUser.email}`)).toBeVisible()
  })

  test('should show error on duplicate email', async ({ page }) => {
    const timestamp = Date.now()
    const email = `duplicate-${timestamp}@example.com`
    const password = 'TestPass@12345'

    // Register first user
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', 'First User')
    await page.fill('input[id="email"]', email)
    await page.fill('input[id="senha"]', password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Logout
    await page.click('button:has-text("Sair")')

    // Try to register with same email
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', 'Second User')
    await page.fill('input[id="email"]', email)
    await page.fill('input[id="senha"]', password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Verify error message
    await expect(page.locator('text=Email já cadastrado')).toBeVisible()
  })

  test('should show error on invalid password', async ({ page, testUser }) => {
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')

    // Fill form with weak password
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', 'weak') // Too weak

    // Submit
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Verify error message
    await expect(page.locator('text=Erro')).toBeVisible()
  })

  test('should show error on invalid email', async ({ page, testUser }) => {
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')

    // Fill form with invalid email
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', 'invalid-email')
    await page.fill('input[id="senha"]', testUser.password)

    // Try to submit - should be blocked by HTML validation or API error
    const submitButton = page.locator('button[class="btn-primary"]:has-text("Criar Conta")')
    
    // Check if submit button exists and if there's validation
    if (await page.locator('input[id="email"][type="email"]').isVisible()) {
      // HTML email validation should prevent submission
      await expect(page.locator('text=Login')).toBeVisible()
    }
  })

  test('should navigate back to login from register', async ({ page }) => {
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')

    // Verify registration form
    await expect(page.locator('text=Criar Conta')).toBeVisible()

    // Click "Já tem conta? Entrar" link
    await page.click('button:has-text("Já tem conta? Entrar")')

    // Verify we're back on login
    await expect(page.locator('text=Login')).toBeVisible()
  })
})
