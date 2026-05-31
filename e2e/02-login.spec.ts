import { test, expect } from './fixtures'

test.describe('Login Flow', () => {
  test('should login with valid credentials', async ({ page, testUser }) => {
    // First register
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("Criar conta")')
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })
    
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Wait for dashboard
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })

    // Logout
    await page.click('button:has-text("Sair")')

    // Wait for login page
    await page.waitForSelector('h2:has-text("Login")', { timeout: 5000 })

    // Login with valid credentials
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Entrar")')

    // Verify dashboard
    await expect(page.locator('text=Bem-vindo')).toBeVisible({ timeout: 10000 })
  })

  test('should show error on invalid credentials', async ({ page, testUser }) => {
    // First register a user
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("Criar conta")')
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })
    
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })

    // Logout
    await page.click('button:has-text("Sair")')
    await page.waitForSelector('h2:has-text("Login")', { timeout: 5000 })

    // Try login with wrong password
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', 'WrongPassword@123')
    await page.click('button[class="btn-primary"]:has-text("Entrar")')

    // Verify error
    await expect(page.locator('div.error-message')).toBeVisible({ timeout: 5000 })
  })

  test('should show error on non-existent user', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.fill('input[id="email"]', 'nonexistent@example.com')
    await page.fill('input[id="senha"]', 'Test@1234')
    await page.click('button[class="btn-primary"]:has-text("Entrar")')

    // Verify error
    await expect(page.locator('div.error-message')).toBeVisible({ timeout: 5000 })
  })

  test('should persist login across page reloads', async ({ page, testUser }) => {
    // Register
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("Criar conta")')
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })
    
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Wait for dashboard
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify still logged in
    await expect(page.locator('text=Bem-vindo')).toBeVisible({ timeout: 5000 })
  })

  test('should clear login on logout', async ({ page, testUser }) => {
    // Register
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("Criar conta")')
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })
    
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Wait for dashboard
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })

    // Logout
    await page.click('button:has-text("Sair")')

    // Verify login page
    await expect(page.locator('h2:has-text("Login")')).toBeVisible({ timeout: 5000 })
  })

  test('should navigate to forgot password page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button:has-text("Esqueceu a senha?")')

    // Verify forgot password form
    await expect(page.locator('h2:has-text("Recuperar Senha")')).toBeVisible({ timeout: 5000 })
  })
})
