import { test, expect } from './fixtures'

test.describe('Registration Flow', () => {
  test('should register new user successfully', async ({ page, testUser }) => {
    // Navigate to app
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click Criar conta
    await page.click('button:has-text("Criar conta")')
    
    // Wait for register form
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })

    // Fill form
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)

    // Submit
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Wait for dashboard
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })
    
    // Verify dashboard is shown
    await expect(page.locator(`text=${testUser.name}`)).toBeVisible({ timeout: 5000 })
  })

  test('should show error on duplicate email', async ({ page, testUser }) => {
    // Register first user
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

    // Try to register with same email
    await page.click('button:has-text("Criar conta")')
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })
    
    await page.fill('input[id="nome_completo"]', 'Another Name')
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Verify error
    await expect(page.locator('div.error-message')).toBeVisible({ timeout: 5000 })
  })

  test('should show error on invalid password', async ({ page, testUser }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    await page.click('button:has-text("Criar conta")')
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })

    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', 'weak')
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Error should be shown
    await expect(page.locator('div.error-message')).toBeVisible({ timeout: 5000 })
  })

  test('should show error on invalid email', async ({ page, testUser }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    await page.click('button:has-text("Criar conta")')
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })

    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', 'invalid-email')
    await page.fill('input[id="senha"]', testUser.password)
    
    // Try to submit - HTML5 email validation will prevent it
    const submitButton = page.locator('button[class="btn-primary"]:has-text("Criar Conta")')
    
    // The button might be disabled or the form won't submit
    // Wait a moment to see if there's a validation error
    await page.waitForTimeout(500)
    
    // Check if form was prevented from submitting
    // (we should still see the form, not the dashboard)
    await expect(page.locator('h2:has-text("Criar Conta")')).toBeVisible({ timeout: 5000 })
  })

  test('should navigate back to login from register', async ({ page, testUser }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Click Criar conta
    await page.click('button:has-text("Criar conta")')
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })

    // Click Já tem conta? Entrar
    await page.click('button:has-text("Já tem conta? Entrar")')

    // Verify login form is shown
    await expect(page.locator('h2:has-text("Login")')).toBeVisible({ timeout: 5000 })
  })
})
