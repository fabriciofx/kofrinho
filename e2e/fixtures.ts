import { test as base, expect } from '@playwright/test'

const CLEANUP_BASE = 'http://localhost:3000/test/users'

async function removerUsuario(email: string): Promise<void> {
  await fetch(`${CLEANUP_BASE}/${encodeURIComponent(email)}`, { method: 'DELETE' }).catch(() => {})
}

interface TestUser {
  name: string
  email: string
  password: string
}

export const test = base.extend<{ testUser: TestUser; authenticatedPage: typeof base }>({
  testUser: async ({}, use) => {
    const timestamp = Date.now()
    const testUser: TestUser = {
      name: `Test User ${timestamp}`,
      email: `test${timestamp}@example.com`,
      password: 'Test@1234'
    }
    await use(testUser)
    // Teardown: remove o usuário (e em cascata: kofrinhos, depositantes,
    // agendamentos, solicitações) caso tenha sido registrado durante o teste.
    await removerUsuario(testUser.email)
  },

  authenticatedPage: async ({ page }, use) => {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const testUser = {
      name: `Test User ${uid}`,
      email: `test${uid}@example.com`,
      password: 'Test@1234'
    }

    // Navigate to app
    await page.goto('/')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Click Criar conta button
    await page.locator('button:has-text("Criar conta")').click()

    // Wait for register form to appear
    await page.waitForSelector('input[id="nome_completo"]', { timeout: 5000 })

    // Fill form
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)

    // Submit and wait for navigation
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')

    // Wait for dashboard to load
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    await use(page)

    // Teardown: remove o usuário e tudo em cascata
    await removerUsuario(testUser.email)
  }
})

export { expect }
