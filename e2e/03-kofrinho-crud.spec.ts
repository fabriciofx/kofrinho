import { test, expect } from './fixtures'

test.describe('Kofrinho CRUD Operations', () => {
  test('should create new kofrinho', async ({ page, authenticatedPage }) => {
    // Use authenticated page
    page = authenticatedPage

    // Scroll to create kofrinho section
    await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()

    // Fill kofrinho form
    await page.fill('input[id="nome"]', 'Viagem de Férias')
    await page.fill('textarea[id="descricao"]', 'Economizar para viagem em 2026')

    // Submit
    await page.click('button:has-text("Criar Kofrinho")')

    // Wait for success message
    await expect(page.locator('text=sucesso')).toBeVisible()

    // Verify kofrinho appears in list
    await expect(page.locator('text=Viagem de Férias')).toBeVisible()
  })

  test('should list all kofrinhos', async ({ page, testUser }) => {
    // Register and login
    await page.goto('/')
    await page.click('button:has-text("Criar conta")')
    await page.fill('input[id="nome_completo"]', testUser.name)
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
    await page.waitForURL('/', { waitUntil: 'networkidle' })

    // Create multiple kofrinhos
    for (let i = 1; i <= 3; i++) {
      await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
      await page.fill('input[id="nome"]', `Kofrinho ${i}`)
      await page.fill('textarea[id="descricao"]', `Description ${i}`)
      await page.click('button:has-text("Criar Kofrinho")')
      await page.waitForTimeout(500)
    }

    // Verify all kofrinhos are listed
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Kofrinho ${i}`)).toBeVisible()
    }
  })

  test('should view kofrinho details', async ({ page, authenticatedPage }) => {
    page = authenticatedPage

    // Create a kofrinho
    await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
    await page.fill('input[id="nome"]', 'Carro Novo')
    await page.fill('textarea[id="descricao"]', 'Economizar para comprar carro')
    await page.click('button:has-text("Criar Kofrinho")')
    await page.waitForTimeout(500)

    // Click "Ver Detalhes"
    await page.click('button:has-text("Ver Detalhes")')

    // Wait for details page to load
    await page.waitForURL(/\/kofrinho\/\d+/)

    // Verify kofrinho details are shown
    await expect(page.locator('text=Carro Novo')).toBeVisible()
    await expect(page.locator('text=Economizar para comprar carro')).toBeVisible()
  })

  test('should edit kofrinho', async ({ page, authenticatedPage }) => {
    page = authenticatedPage

    // Create a kofrinho
    await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
    await page.fill('input[id="nome"]', 'Original Name')
    await page.fill('textarea[id="descricao"]', 'Original description')
    await page.click('button:has-text("Criar Kofrinho")')
    await page.waitForTimeout(500)

    // Navigate to details
    await page.click('button:has-text("Ver Detalhes")')
    await page.waitForURL(/\/kofrinho\/\d+/)

    // Click Edit
    await page.click('button:has-text("Editar")')

    // Verify form is now editable
    await expect(page.locator('input[id="nome"]')).toHaveValue('Original Name')

    // Update fields
    await page.fill('input[id="nome"]', 'Updated Name')
    await page.fill('textarea[id="descricao"]', 'Updated description')

    // Save
    await page.click('button:has-text("Salvar")')

    // Wait for success message
    await expect(page.locator('text=sucesso')).toBeVisible()

    // Verify updated data is displayed
    await expect(page.locator('text=Updated Name')).toBeVisible()
    await expect(page.locator('text=Updated description')).toBeVisible()
  })

  test('should delete kofrinho', async ({ page, authenticatedPage }) => {
    page = authenticatedPage

    // Create a kofrinho
    await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
    await page.fill('input[id="nome"]', 'To Delete')
    await page.fill('textarea[id="descricao"]', 'This will be deleted')
    await page.click('button:has-text("Criar Kofrinho")')
    await page.waitForTimeout(500)

    // Verify kofrinho is in list
    await expect(page.locator('text=To Delete')).toBeVisible()

    // Click Delete on dashboard
    const kofrinhoCard = page.locator('text=To Delete').locator('..')
    await kofrinhoCard.locator('button:has-text("Deletar")').click()

    // Confirm deletion if dialog appears
    if (await page.locator('text=Tem certeza').isVisible()) {
      await page.click('button:has-text("Deletar")')
    }

    // Wait for success message
    await expect(page.locator('text=sucesso')).toBeVisible()

    // Verify kofrinho is removed from list
    await expect(page.locator('text=To Delete')).not.toBeVisible()
  })

  test('should show error on missing kofrinho name', async ({ page, authenticatedPage }) => {
    page = authenticatedPage

    // Scroll to create kofrinho section
    await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()

    // Try to submit without name
    await page.fill('textarea[id="descricao"]', 'Some description')
    await page.click('button:has-text("Criar Kofrinho")')

    // Verify error message
    await expect(page.locator('text=obrigatório')).toBeVisible()
  })

  test('should cancel edit and revert changes', async ({ page, authenticatedPage }) => {
    page = authenticatedPage

    // Create a kofrinho
    await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
    await page.fill('input[id="nome"]', 'Original Name')
    await page.fill('textarea[id="descricao"]', 'Original description')
    await page.click('button:has-text("Criar Kofrinho")')
    await page.waitForTimeout(500)

    // Navigate to details
    await page.click('button:has-text("Ver Detalhes")')
    await page.waitForURL(/\/kofrinho\/\d+/)

    // Click Edit
    await page.click('button:has-text("Editar")')

    // Change fields
    await page.fill('input[id="nome"]', 'Changed Name')

    // Click Cancel
    await page.click('button:has-text("Cancelar")')

    // Verify original data is shown
    await expect(page.locator('text=Original Name')).toBeVisible()
    await expect(page.locator('text=Changed Name')).not.toBeVisible()
  })
})
