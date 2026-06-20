import { test, expect } from './fixtures'

test.describe('Landing Page', () => {
  test('exibe a landing page quando o usuário não está autenticado', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.landing-page')).toBeVisible()
    await expect(page.locator('.landing-hero-title')).toBeVisible()
  })

  test('exibe o logo do Kofrinho na hero e no header', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const logoHero = page.locator('.landing-hero-logo')
    await expect(logoHero).toBeVisible()
    await expect(logoHero).toHaveAttribute('src', '/kofrinho.png')

    const logoBrand = page.locator('.landing-brand-logo')
    await expect(logoBrand).toBeVisible()
    await expect(logoBrand).toHaveAttribute('src', '/kofrinho.png')
  })

  test('botão "Login" no header abre o modal de login', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-login')

    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-header h2:has-text("Login")')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#senha')).toBeVisible()
  })

  test('botão "Criar Conta" no header abre o modal de cadastro', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-register')

    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-header h2:has-text("Criar Conta")')).toBeVisible()
    await expect(page.locator('#nome_completo')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#senha')).toBeVisible()
  })

  test('botão "Criar Conta Grátis" na hero abre o modal de cadastro', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-cta-primary')

    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-header h2:has-text("Criar Conta")')).toBeVisible()
  })

  test('botão "Já tenho conta" na hero abre o modal de login', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-cta-secondary')

    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-header h2:has-text("Login")')).toBeVisible()
  })

  test('modal de login fecha ao clicar no botão X', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-login')
    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })

    await page.click('.modal-close-btn')
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })
  })

  test('modal de cadastro fecha ao clicar no botão X', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-register')
    await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 })

    await page.click('.modal-close-btn')
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 })
  })

  test('link "Criar conta" dentro do modal de login abre o modal de cadastro', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-login')
    await expect(page.locator('.modal-header h2:has-text("Login")')).toBeVisible()

    await page.click('.modal-content button:has-text("Criar conta")')

    await expect(page.locator('.modal-header h2:has-text("Criar Conta")')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#nome_completo')).toBeVisible()
  })

  test('link "Já tem conta?" dentro do modal de cadastro abre o modal de login', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-register')
    await expect(page.locator('.modal-header h2:has-text("Criar Conta")')).toBeVisible()

    await page.click('.modal-content button:has-text("Já tem conta?")')

    await expect(page.locator('.modal-header h2:has-text("Login")')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#email')).toBeVisible()
  })

  test('link "Esqueceu a senha?" abre o modal de recuperação de senha', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-login')
    await expect(page.locator('.modal-header h2:has-text("Login")')).toBeVisible()

    await page.click('.modal-content button:has-text("Esqueceu a senha?")')

    await expect(page.locator('.modal-header h2:has-text("Recuperar Senha")')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#forgot-email')).toBeVisible()
  })

  test('link "Voltar ao login" dentro de recuperar senha retorna ao login', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-login')
    await page.click('.modal-content button:has-text("Esqueceu a senha?")')
    await expect(page.locator('.modal-header h2:has-text("Recuperar Senha")')).toBeVisible()

    await page.click('.modal-content button:has-text("Voltar ao login")')

    await expect(page.locator('.modal-header h2:has-text("Login")')).toBeVisible({ timeout: 5000 })
  })

  test('login com credenciais inválidas exibe mensagem de erro no modal', async ({ page, testUser }) => {
    // Registra o usuário primeiro para garantir que ele existe
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.click('button.btn-landing-register')
    await page.fill('#nome_completo', testUser.name)
    await page.fill('#email', testUser.email)
    await page.fill('#senha', testUser.password)
    await page.click('.modal-content button[type="submit"]')
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })

    // Faz logout e tenta login com senha errada
    await page.click('button:has-text("Sair")')
    await page.waitForSelector('.modal-header h2:has-text("Login")', { timeout: 5000 })

    await page.fill('#email', testUser.email)
    await page.fill('#senha', 'SenhaErrada@999')
    await page.click('button[class="btn-primary"]:has-text("Entrar")')

    await expect(page.locator('div.error-message')).toBeVisible({ timeout: 5000 })
  })

  test('cadastro com senha fraca exibe mensagem de erro no modal', async ({ page, testUser }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-register')
    await page.fill('#nome_completo', testUser.name)
    await page.fill('#email', testUser.email)
    await page.fill('#senha', 'fraca')
    await page.click('.modal-content button[type="submit"]')

    await expect(page.locator('div.error-message')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.modal-content')).toBeVisible()
  })

  test('pode criar conta via modal e acessar o dashboard', async ({ page, testUser }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.click('button.btn-landing-register')
    await expect(page.locator('.modal-header h2:has-text("Criar Conta")')).toBeVisible()

    await page.fill('#nome_completo', testUser.name)
    await page.fill('#email', testUser.email)
    await page.fill('#senha', testUser.password)
    await page.click('.modal-content button[type="submit"]')

    await expect(page.locator('text=Bem-vindo')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.dashboard-container')).toBeVisible()
  })

  test('pode fazer login via modal e acessar o dashboard', async ({ page, testUser }) => {
    // Cria conta primeiro
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.click('button.btn-landing-register')
    await page.fill('#nome_completo', testUser.name)
    await page.fill('#email', testUser.email)
    await page.fill('#senha', testUser.password)
    await page.click('.modal-content button[type="submit"]')
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })

    // Faz logout e loga novamente
    await page.click('button:has-text("Sair")')
    await page.waitForSelector('.modal-header h2:has-text("Login")', { timeout: 5000 })

    await page.fill('#email', testUser.email)
    await page.fill('#senha', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Entrar")')

    await expect(page.locator('text=Bem-vindo')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.dashboard-container')).toBeVisible()
  })

  test('redireciona para landing page ao acessar rota protegida sem autenticação', async ({ page }) => {
    await page.goto('/kofrinho/1')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.landing-page')).toBeVisible()
    await expect(page.locator('text=Login')).toBeVisible()
  })
})
