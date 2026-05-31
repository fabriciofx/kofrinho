import { test, expect } from './fixtures'

test.describe('Login Flow', () => {
  test('should login with valid credentials', async ({ page, testUser }) => {
    // First register a user
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Logout
    await page.click('button:has-text("Sair")')

    // Verify we're back on login page
    await expect(page.locator('text=Login')).toBeVisible()

    // Login with same credentials
    await page.fill('input[name="email"]', testUser.email)
    await page.fill('input[name="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Entrar")')

    // Wait for dashboard
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Verify user is logged in
    await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()
  })

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/')

    // Try login with wrong password
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="senha"]', 'WrongPassword@123')
    await page.click('button[class="btn-primary"]:has-text("Entrar")')

    // Verify error message
    await expect(page.locator('text=Erro')).toBeVisible()
  })

  test('should show error on non-existent user', async ({ page }) => {
    await page.goto('/')

    // Try login with non-existent email
    await page.fill('input[name="email"]', `nonexistent-${Date.now()}@example.com`)
    await page.fill('input[name="senha"]', 'SomePass@123')
    await page.click('button[class="btn-primary"]:has-text("Entrar")')

    // Verify error message
    await expect(page.locator('text=Erro')).toBeVisible()
  })

  test('should persist login across page reloads', async ({ page, testUser }) => {
    // Use authenticatedPage fixture to login
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Verify dashboard is shown
    await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()

    // Reload page
    await page.reload()

    // Verify user is still logged in after reload
    await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()
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
    await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()

    // Logout
    await page.click('button:has-text("Sair")')

    // Verify we're back on login page
    await expect(page.locator('text=Login')).toBeVisible()
    await expect(page.locator('text=Bem-vindo')).not.toBeVisible()
  })

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/')

    // Click "Esqueceu a senha?" link
    await page.click('button:has-text("Esqueceu a senha?")')

    // Verify password recovery form is shown
    await expect(page.locator('text=Recuperar Senha')).toBeVisible()

    // Verify email field exists
    await expect(page.locator('input[name="email"]')).toBeVisible()
  })
})
