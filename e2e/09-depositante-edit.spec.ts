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

async function criarDepositante(
  page: any,
  kofrinhoNome: string,
  depositanteNome: string,
  valor: string,
  email: string
) {
  await page.locator('.kofrinho-card').filter({ hasText: kofrinhoNome })
    .locator('button:has-text("Criar Depositante")').click()
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('input[id="depositante-nome"]', depositanteNome)
  await page.fill('input[id="depositante-valor"]', valor)
  await page.fill('input[id="depositante-email"]', email)
  await page.locator('.modal-content button[type="submit"]').click()
  await expect(page.locator('text=Depositante criado com sucesso')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
}

async function irParaDetalhes(page: any, kofrinhoNome: string) {
  await page.locator('.kofrinho-card').filter({ hasText: kofrinhoNome })
    .locator('button:has-text("Ver Detalhes")').click()
  await expect(page).toHaveURL(/\/kofrinho\/\d+/, { timeout: 5000 })
  await page.waitForLoadState('networkidle')
  await expect(page.locator('.depositantes-table')).toBeVisible({ timeout: 8000 })
}

test.describe('Editar Depositante', () => {
  test('deve exibir ícone de editar (✏️) em cada linha da tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Salário', '3000', 'salario@teste.com')
    await irParaDetalhes(page, nome)

    const icone = page.locator('.depositantes-table tbody tr').first().locator('.btn-edit-depositante')
    await expect(icone).toBeVisible()
    await expect(icone).toHaveAttribute('title', 'Editar depositante')
  })

  test('deve abrir modal "Editar Depositante" ao clicar no ícone', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Bônus', '500', 'bonus@teste.com')
    await irParaDetalhes(page, nome)

    await page.locator('.btn-edit-depositante').first().click()
    await expect(page.locator('.modal-header h2')).toHaveText('Editar Depositante')
    await expect(page.locator('.modal-content')).toBeVisible()
  })

  test('deve pré-preencher o modal com os dados atuais do depositante', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Poupança', '1500', 'poupanca@teste.com')
    await irParaDetalhes(page, nome)

    await page.locator('.btn-edit-depositante').first().click()

    await expect(page.locator('input[id="edit-depositante-nome"]')).toHaveValue('Poupança')
    await expect(page.locator('input[id="edit-depositante-valor"]')).toHaveValue('1500')
    await expect(page.locator('input[id="edit-depositante-email"]')).toHaveValue('poupanca@teste.com')
  })

  test('deve salvar alterações e atualizar a tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Antigo Nome', '200', 'antigo@teste.com')
    await irParaDetalhes(page, nome)

    await page.locator('.btn-edit-depositante').first().click()
    await page.fill('input[id="edit-depositante-nome"]', 'Novo Nome')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depositante atualizado com sucesso')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Novo Nome' })).toBeVisible()
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Antigo Nome' })).not.toBeVisible()
  })

  test('deve atualizar o e-mail do depositante', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Dep Email', '300', 'velho@email.com')
    await irParaDetalhes(page, nome)

    await page.locator('.btn-edit-depositante').first().click()
    await page.fill('input[id="edit-depositante-email"]', 'novo@email.com')
    await page.locator('.modal-content button[type="submit"]').click()

    await expect(page.locator('text=Depositante atualizado com sucesso')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'novo@email.com' })).toBeVisible()
  })

  test('deve fechar o modal ao clicar no botão X sem salvar', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Mantém', '100', 'mantem@teste.com')
    await irParaDetalhes(page, nome)

    await page.locator('.btn-edit-depositante').first().click()
    await page.fill('input[id="edit-depositante-nome"]', 'Descartado')
    await page.click('.modal-close-btn')

    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Mantém' })).toBeVisible()
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Descartado' })).not.toBeVisible()
  })

  test('deve editar depositantes diferentes de forma independente', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Dep A', '100', 'a@teste.com')
    await criarDepositante(page, nome, 'Dep B', '200', 'b@teste.com')
    await irParaDetalhes(page, nome)

    // Edita apenas Dep A
    await page.locator('.depositantes-table tbody tr').filter({ hasText: 'Dep A' })
      .locator('.btn-edit-depositante').click()
    await page.fill('input[id="edit-depositante-nome"]', 'Dep A Editado')
    await page.locator('.modal-content button[type="submit"]').click()
    await expect(page.locator('.modal-backdrop')).not.toBeVisible({ timeout: 5000 })

    // Dep B deve continuar intacto
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Dep A Editado' })).toBeVisible()
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Dep B' })).toBeVisible()
  })
})
