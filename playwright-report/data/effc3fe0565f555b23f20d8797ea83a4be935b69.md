# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-registration.spec.ts >> Registration Flow >> should show error on invalid password
- Location: e2e/01-registration.spec.ts:61:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Erro')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Erro')

```

```yaml
- heading "Kofrinho - Seu Cofre Digital" [level=1]
- text: Senha não atende aos requisitos
- heading "Criar Conta" [level=2]
- text: Nome Completo
- textbox "Nome Completo":
  - /placeholder: Seu nome
  - text: Test User 1780232461617
- text: Email
- textbox "Email":
  - /placeholder: seu@email.com
  - text: test-1780232461617@example.com
- text: Senha
- textbox "Senha":
  - /placeholder: Mínimo 8 caracteres com maiúsculas, minúsculas, números e caracteres especiais
  - text: weak
- text: "Requisitos: 8+ caracteres, maiúscula, minúscula, número, caractere especial"
- button "Criar Conta"
- button "Já tem conta? Entrar"
```

# Test source

```ts
  1   | import { test, expect } from './fixtures'
  2   | 
  3   | test.describe('Registration Flow', () => {
  4   |   test('should register new user successfully', async ({ page, testUser }) => {
  5   |     // Navigate to login page
  6   |     await page.goto('/')
  7   | 
  8   |     // Verify login page is shown
  9   |     await expect(page.locator('text=Login')).toBeVisible()
  10  | 
  11  |     // Click "Criar conta" button
  12  |     await page.click('button:has-text("Criar conta")')
  13  | 
  14  |     // Verify registration form is shown
  15  |     await expect(page.locator('text=Criar Conta')).toBeVisible()
  16  | 
  17  |     // Fill registration form
  18  |     await page.fill('input[id="nome_completo"]', testUser.name)
  19  |     await page.fill('input[id="email"]', testUser.email)
  20  |     await page.fill('input[id="senha"]', testUser.password)
  21  | 
  22  |     // Submit registration
  23  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  24  | 
  25  |     // Wait for dashboard to load
  26  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  27  | 
  28  |     // Verify user is logged in and on dashboard
  29  |     await expect(page.locator(`text=Bem-vindo, ${testUser.name}`)).toBeVisible()
  30  |     await expect(page.locator(`text=${testUser.email}`)).toBeVisible()
  31  |   })
  32  | 
  33  |   test('should show error on duplicate email', async ({ page }) => {
  34  |     const timestamp = Date.now()
  35  |     const email = `duplicate-${timestamp}@example.com`
  36  |     const password = 'TestPass@12345'
  37  | 
  38  |     // Register first user
  39  |     await page.goto('/')
  40  |     await page.click('button:has-text("Criar conta")')
  41  |     await page.fill('input[id="nome_completo"]', 'First User')
  42  |     await page.fill('input[id="email"]', email)
  43  |     await page.fill('input[id="senha"]', password)
  44  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  45  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  46  | 
  47  |     // Logout
  48  |     await page.click('button:has-text("Sair")')
  49  | 
  50  |     // Try to register with same email
  51  |     await page.click('button:has-text("Criar conta")')
  52  |     await page.fill('input[id="nome_completo"]', 'Second User')
  53  |     await page.fill('input[id="email"]', email)
  54  |     await page.fill('input[id="senha"]', password)
  55  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  56  | 
  57  |     // Verify error message
  58  |     await expect(page.locator('text=Email já cadastrado')).toBeVisible()
  59  |   })
  60  | 
  61  |   test('should show error on invalid password', async ({ page, testUser }) => {
  62  |     await page.goto('/')
  63  |     await page.click('button:has-text("Criar conta")')
  64  | 
  65  |     // Fill form with weak password
  66  |     await page.fill('input[id="nome_completo"]', testUser.name)
  67  |     await page.fill('input[id="email"]', testUser.email)
  68  |     await page.fill('input[id="senha"]', 'weak') // Too weak
  69  | 
  70  |     // Submit
  71  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  72  | 
  73  |     // Verify error message
> 74  |     await expect(page.locator('text=Erro')).toBeVisible()
      |                                             ^ Error: expect(locator).toBeVisible() failed
  75  |   })
  76  | 
  77  |   test('should show error on invalid email', async ({ page, testUser }) => {
  78  |     await page.goto('/')
  79  |     await page.click('button:has-text("Criar conta")')
  80  | 
  81  |     // Fill form with invalid email
  82  |     await page.fill('input[id="nome_completo"]', testUser.name)
  83  |     await page.fill('input[id="email"]', 'invalid-email')
  84  |     await page.fill('input[id="senha"]', testUser.password)
  85  | 
  86  |     // Try to submit - should be blocked by HTML validation or API error
  87  |     const submitButton = page.locator('button[class="btn-primary"]:has-text("Criar Conta")')
  88  |     
  89  |     // Check if submit button exists and if there's validation
  90  |     if (await page.locator('input[id="email"][type="email"]').isVisible()) {
  91  |       // HTML email validation should prevent submission
  92  |       await expect(page.locator('text=Login')).toBeVisible()
  93  |     }
  94  |   })
  95  | 
  96  |   test('should navigate back to login from register', async ({ page }) => {
  97  |     await page.goto('/')
  98  |     await page.click('button:has-text("Criar conta")')
  99  | 
  100 |     // Verify registration form
  101 |     await expect(page.locator('text=Criar Conta')).toBeVisible()
  102 | 
  103 |     // Click "Já tem conta? Entrar" link
  104 |     await page.click('button:has-text("Já tem conta? Entrar")')
  105 | 
  106 |     // Verify we're back on login
  107 |     await expect(page.locator('text=Login')).toBeVisible()
  108 |   })
  109 | })
  110 | 
```