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

async function criarDepositante(page: any, kofrinhoNome: string, depositanteNome: string, valor: string) {
  await page.locator('.kofrinho-card').filter({ hasText: kofrinhoNome })
    .locator('button:has-text("Criar Depositante")').click()
  await page.waitForSelector('.modal-content', { timeout: 5000 })
  await page.fill('input[id="depositante-nome"]', depositanteNome)
  await page.fill('input[id="depositante-valor"]', valor)
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

test.describe('Deletar Depositante', () => {
  test('deve exibir ícone de lixeira em cada linha da tabela', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Depositante A', '100')
    await irParaDetalhes(page, nome)

    const lixeira = page.locator('.depositantes-table tbody tr').first().locator('.btn-delete-depositante')
    await expect(lixeira).toBeVisible()
    await expect(lixeira).toHaveAttribute('title', 'Remover depositante')
  })

  test('deve remover o depositante da tabela ao confirmar a exclusão', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Salário', '3000')
    await irParaDetalhes(page, nome)

    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Salário' })).toBeVisible()

    // Confirmar dialog de exclusão
    page.once('dialog', dialog => dialog.accept())
    await page.locator('.depositantes-table tbody tr').filter({ hasText: 'Salário' })
      .locator('.btn-delete-depositante').click()

    // Depositante deve desaparecer da tabela
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Salário' }))
      .not.toBeVisible({ timeout: 5000 })
  })

  test('deve mostrar estado vazio após remover o único depositante', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Único', '50')
    await irParaDetalhes(page, nome)

    page.once('dialog', dialog => dialog.accept())
    await page.locator('.btn-delete-depositante').first().click()

    await expect(page.locator('text=Nenhum depositante cadastrado ainda')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.depositantes-table')).not.toBeVisible()
  })

  test('não deve remover o depositante ao cancelar o dialog', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Permanente', '200')
    await irParaDetalhes(page, nome)

    // Rejeitar o dialog (cancelar)
    page.once('dialog', dialog => dialog.dismiss())
    await page.locator('.btn-delete-depositante').first().click()

    // Depositante deve continuar na tabela
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Permanente' })).toBeVisible()
  })

  test('deve remover apenas o depositante correto quando há múltiplos', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Manter Este', '100')
    await criarDepositante(page, nome, 'Apagar Este', '999')
    await irParaDetalhes(page, nome)

    await expect(page.locator('.depositantes-table tbody tr')).toHaveCount(2, { timeout: 5000 })

    page.once('dialog', dialog => dialog.accept())
    await page.locator('.depositantes-table tbody tr').filter({ hasText: 'Apagar Este' })
      .locator('.btn-delete-depositante').click()

    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Apagar Este' }))
      .not.toBeVisible({ timeout: 5000 })
    await expect(page.locator('.depositantes-table tbody tr').filter({ hasText: 'Manter Este' })).toBeVisible()
    await expect(page.locator('.depositantes-table tbody tr')).toHaveCount(1)
  })

  test('depositante removido não deve reaparecer ao recarregar a página de detalhes', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')

    const nome = `Kofrinho ${Date.now()}`
    await criarKofrinho(page, nome)
    await criarDepositante(page, nome, 'Efêmero', '77')
    await irParaDetalhes(page, nome)

    page.once('dialog', dialog => dialog.accept())
    await page.locator('.btn-delete-depositante').first().click()
    await expect(page.locator('text=Nenhum depositante cadastrado ainda')).toBeVisible({ timeout: 5000 })

    // Voltar ao dashboard e entrar em detalhes novamente
    await page.click('.btn-back')
    await page.waitForLoadState('networkidle')
    await irParaDetalhes(page, nome)

    await expect(page.locator('text=Nenhum depositante cadastrado ainda')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.depositantes-table')).not.toBeVisible()
  })
})
