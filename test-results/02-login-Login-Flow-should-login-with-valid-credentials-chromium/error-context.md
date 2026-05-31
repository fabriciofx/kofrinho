# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 02-login.spec.ts >> Login Flow >> should login with valid credentials
- Location: e2e/02-login.spec.ts:4:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Bem-vindo, Test User 1780232462728')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Bem-vindo, Test User 1780232462728')

```

```yaml
- banner:
  - heading "Kofrinho - Seu Cofre Digital" [level=1]
  - button "Sair"
- complementary:
  - heading "Bem-vindo!" [level=3]
  - paragraph: Test User 1780232462728
  - paragraph: test-1780232462728@example.com
  - text: Sem foto
  - button "Alterar foto"
- main:
  - heading "Meus Kofrinhos" [level=2]
  - paragraph: Você ainda não tem kofrinhos. Crie um novo!
  - heading "Criar Novo Kofrinho" [level=2]
  - text: Nome do Kofrinho *
  - textbox "Nome do Kofrinho *":
    - /placeholder: "Ex: Viagem, Carro, Investimento"
  - text: Descrição (opcional)
  - textbox "Descrição (opcional)":
    - /placeholder: Descreva para que serve este kofrinho
  - button "Criar Kofrinho"
```

# Test source

```ts
  1   | import { test, expect } from './fixtures'
  2   | 
  3   | test.describe('Login Flow', () => {
  4   |   test('should login with valid credentials', async ({ page, testUser }) => {
  5   |     // First register a user
  6   |     await page.goto('/')
  7   |     await page.click('button:has-text("Criar conta")')
  8   |     await page.fill('input[id="nome_completo"]', testUser.name)
  9   |     await page.fill('input[id="email"]', testUser.email)
  10  |     await page.fill('input[id="senha"]', testUser.password)
  11  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  12  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  13  | 
  14  |     // Logout
  15  |     await page.click('button:has-text("Sair")')
  16  | 
  17  |     // Verify we're back on login page
  18  |     await expect(page.locator('text=Login')).toBeVisible()
  19  | 
  20  |     // Login with same credentials
  21  |     await page.fill('input[name="email"]', testUser.email)
  22  |     await page.fill('input[name="senha"]', testUser.password)
  23  |     await page.click('button[class="btn-primary"]:has-text("Entrar")')
  24  | 
  25  |     // Wait for dashboard
  26  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  27  | 
  28  |     // Verify user is logged in
> 29  |     await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
  30  |   })
  31  | 
  32  |   test('should show error on invalid credentials', async ({ page }) => {
  33  |     await page.goto('/')
  34  | 
  35  |     // Try login with wrong password
  36  |     await page.fill('input[name="email"]', 'test@example.com')
  37  |     await page.fill('input[name="senha"]', 'WrongPassword@123')
  38  |     await page.click('button[class="btn-primary"]:has-text("Entrar")')
  39  | 
  40  |     // Verify error message
  41  |     await expect(page.locator('text=Erro')).toBeVisible()
  42  |   })
  43  | 
  44  |   test('should show error on non-existent user', async ({ page }) => {
  45  |     await page.goto('/')
  46  | 
  47  |     // Try login with non-existent email
  48  |     await page.fill('input[name="email"]', `nonexistent-${Date.now()}@example.com`)
  49  |     await page.fill('input[name="senha"]', 'SomePass@123')
  50  |     await page.click('button[class="btn-primary"]:has-text("Entrar")')
  51  | 
  52  |     // Verify error message
  53  |     await expect(page.locator('text=Erro')).toBeVisible()
  54  |   })
  55  | 
  56  |   test('should persist login across page reloads', async ({ page, testUser }) => {
  57  |     // Use authenticatedPage fixture to login
  58  |     await page.goto('/')
  59  |     await page.click('button:has-text("Criar conta")')
  60  |     await page.fill('input[id="nome_completo"]', testUser.name)
  61  |     await page.fill('input[id="email"]', testUser.email)
  62  |     await page.fill('input[id="senha"]', testUser.password)
  63  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  64  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  65  | 
  66  |     // Verify dashboard is shown
  67  |     await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()
  68  | 
  69  |     // Reload page
  70  |     await page.reload()
  71  | 
  72  |     // Verify user is still logged in after reload
  73  |     await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()
  74  |   })
  75  | 
  76  |   test('should clear login on logout', async ({ page, testUser }) => {
  77  |     // Register and login
  78  |     await page.goto('/')
  79  |     await page.click('button:has-text("Criar conta")')
  80  |     await page.fill('input[id="nome_completo"]', testUser.name)
  81  |     await page.fill('input[id="email"]', testUser.email)
  82  |     await page.fill('input[id="senha"]', testUser.password)
  83  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  84  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  85  | 
  86  |     // Verify dashboard
  87  |     await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()
  88  | 
  89  |     // Logout
  90  |     await page.click('button:has-text("Sair")')
  91  | 
  92  |     // Verify we're back on login page
  93  |     await expect(page.locator('text=Login')).toBeVisible()
  94  |     await expect(page.locator('text=Bem-vindo')).not.toBeVisible()
  95  |   })
  96  | 
  97  |   test('should navigate to forgot password page', async ({ page }) => {
  98  |     await page.goto('/')
  99  | 
  100 |     // Click "Esqueceu a senha?" link
  101 |     await page.click('button:has-text("Esqueceu a senha?")')
  102 | 
  103 |     // Verify password recovery form is shown
  104 |     await expect(page.locator('text=Recuperar Senha')).toBeVisible()
  105 | 
  106 |     // Verify email field exists
  107 |     await expect(page.locator('input[name="email"]')).toBeVisible()
  108 |   })
  109 | })
  110 | 
```