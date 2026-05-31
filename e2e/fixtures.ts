import { test as base, expect } from '@playwright/test'

interface TestFixtures {
  authenticatedPage: any
  testUser: {
    email: string
    password: string
    name: string
  }
}

export const test = base.extend<TestFixtures>({
  testUser: async ({}, use) => {
    const timestamp = Date.now()
    const user = {
      email: `test-${timestamp}@example.com`,
      password: 'TestPass@12345',
      name: `Test User ${timestamp}`,
    }
    await use(user)
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Navigate to login page
    await page.goto('/')

    // Click register button
    await page.click('button:has-text("Criar conta")')

    // Fill registration form
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)

    // Submit registration
    await page.click('button:has-text("Criar Conta")')

    // Wait for dashboard to load
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Verify dashboard is shown
    await expect(page.locator('text=Bem-vindo')).toBeVisible()

    await use(page)
  },
})

export { expect }
