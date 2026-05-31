# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-auth-persistence.spec.ts >> Authentication State Persistence >> should maintain user data across app navigation
- Location: e2e/05-auth-persistence.spec.ts:100:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("← Voltar")')
    2 × locator resolved to <button type="button" class="btn-back">← Voltar</button>
    - attempting click action
      - waiting for element to be visible, enabled and stable
    - element was detached from the DOM, retrying

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "Kofrinho - Seu Cofre Digital" [level=1] [ref=e5]
    - button "Sair" [ref=e6] [cursor=pointer]
  - generic [ref=e7]:
    - complementary [ref=e8]:
      - generic [ref=e9]:
        - heading "Bem-vindo!" [level=3] [ref=e10]
        - paragraph [ref=e11]: Test User 1780232478849
        - paragraph [ref=e12]: test-1780232478849@example.com
        - generic [ref=e13]:
          - generic [ref=e15]: Sem foto
          - button "Alterar foto" [ref=e17] [cursor=pointer]
    - main [ref=e18]:
      - generic [ref=e19]:
        - heading "Meus Kofrinhos" [level=2] [ref=e20]
        - generic [ref=e22]:
          - heading "Test Kofrinho" [level=3] [ref=e23]
          - paragraph [ref=e24]: Test
          - paragraph [ref=e25]: "Criado em: 31/05/2026"
          - generic [ref=e26]:
            - button "Ver Detalhes" [ref=e27] [cursor=pointer]
            - button "Deletar" [ref=e28] [cursor=pointer]
      - generic [ref=e30]:
        - heading "Criar Novo Kofrinho" [level=2] [ref=e31]
        - generic [ref=e32]:
          - generic [ref=e33]:
            - generic [ref=e34]: Nome do Kofrinho *
            - textbox "Nome do Kofrinho *" [ref=e35]:
              - /placeholder: "Ex: Viagem, Carro, Investimento"
          - generic [ref=e36]:
            - generic [ref=e37]: Descrição (opcional)
            - textbox "Descrição (opcional)" [ref=e38]:
              - /placeholder: Descreva para que serve este kofrinho
          - button "Criar Kofrinho" [ref=e39] [cursor=pointer]
```

# Test source

```ts
  25  |     // Register and login
  26  |     await page.goto('/')
  27  |     await page.click('button:has-text("Criar conta")')
  28  |     await page.fill('input[id="nome_completo"]', testUser.name)
  29  |     await page.fill('input[id="email"]', testUser.email)
  30  |     await page.fill('input[id="senha"]', testUser.password)
  31  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  32  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  33  | 
  34  |     // Verify user is on dashboard
  35  |     await expect(page.locator(`text=Bem-vindo`)).toBeVisible()
  36  | 
  37  |     // Reload page
  38  |     await page.reload()
  39  | 
  40  |     // Verify user is still logged in
  41  |     await expect(page.locator(`text=Bem-vindo`)).toBeVisible()
  42  |   })
  43  | 
  44  |   test('should clear tokens on logout', async ({ page, testUser }) => {
  45  |     // Register and login
  46  |     await page.goto('/')
  47  |     await page.click('button:has-text("Criar conta")')
  48  |     await page.fill('input[id="nome_completo"]', testUser.name)
  49  |     await page.fill('input[id="email"]', testUser.email)
  50  |     await page.fill('input[id="senha"]', testUser.password)
  51  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  52  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  53  | 
  54  |     // Verify tokens exist
  55  |     const tokensBefore = await page.evaluate(() => {
  56  |       return localStorage.getItem('authTokens')
  57  |     })
  58  |     expect(tokensBefore).toBeTruthy()
  59  | 
  60  |     // Logout
  61  |     await page.click('button:has-text("Sair")')
  62  | 
  63  |     // Check tokens are cleared
  64  |     const tokensAfter = await page.evaluate(() => {
  65  |       return localStorage.getItem('authTokens')
  66  |     })
  67  |     expect(tokensAfter).toBeNull()
  68  | 
  69  |     // Verify we're on login page
  70  |     await expect(page.locator('text=Login')).toBeVisible()
  71  |   })
  72  | 
  73  |   test('should redirect to login if token is invalid', async ({ page }) => {
  74  |     // Set invalid token
  75  |     await page.evaluate(() => {
  76  |       localStorage.setItem('authTokens', JSON.stringify({
  77  |         token: 'invalid-token-xxx',
  78  |         refreshToken: 'invalid-refresh-xxx'
  79  |       }))
  80  |     })
  81  | 
  82  |     // Try to access dashboard
  83  |     await page.goto('/')
  84  | 
  85  |     // Should redirect to login or show error
  86  |     const isOnLogin = await page.locator('text=Login').isVisible()
  87  |     const hasError = await page.locator('text=Erro').isVisible()
  88  | 
  89  |     expect(isOnLogin || hasError).toBeTruthy()
  90  |   })
  91  | 
  92  |   test('should prevent unauthenticated access to kofrinho details', async ({ page }) => {
  93  |     // Try to access kofrinho details without authentication
  94  |     await page.goto('/kofrinho/1')
  95  | 
  96  |     // Should redirect to login
  97  |     await expect(page.locator('text=Login')).toBeVisible()
  98  |   })
  99  | 
  100 |   test('should maintain user data across app navigation', async ({ page, testUser }) => {
  101 |     // Register
  102 |     await page.goto('/')
  103 |     await page.click('button:has-text("Criar conta")')
  104 |     await page.fill('input[id="nome_completo"]', testUser.name)
  105 |     await page.fill('input[id="email"]', testUser.email)
  106 |     await page.fill('input[id="senha"]', testUser.password)
  107 |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  108 |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  109 | 
  110 |     // Verify user info on dashboard
  111 |     await expect(page.locator(`text=${testUser.name}`)).toBeVisible()
  112 | 
  113 |     // Create a kofrinho
  114 |     await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
  115 |     await page.fill('input[id="nome"]', 'Test Kofrinho')
  116 |     await page.fill('textarea[id="descricao"]', 'Test')
  117 |     await page.click('button:has-text("Criar Kofrinho")')
  118 |     await page.waitForTimeout(500)
  119 | 
  120 |     // Navigate to kofrinho details
  121 |     await page.click('button:has-text("Ver Detalhes")')
  122 |     await page.waitForURL(/\/kofrinho\/\d+/)
  123 | 
  124 |     // Navigate back
> 125 |     await page.click('button:has-text("← Voltar")')
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  126 | 
  127 |     // Verify user is still logged in
  128 |     await expect(page.locator(`text=${testUser.name}`)).toBeVisible()
  129 |   })
  130 | 
  131 |   test('should handle logout during pending requests gracefully', async ({ page, testUser }) => {
  132 |     // Register
  133 |     await page.goto('/')
  134 |     await page.click('button:has-text("Criar conta")')
  135 |     await page.fill('input[id="nome_completo"]', testUser.name)
  136 |     await page.fill('input[id="email"]', testUser.email)
  137 |     await page.fill('input[id="senha"]', testUser.password)
  138 |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  139 |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  140 | 
  141 |     // Immediately logout
  142 |     await page.click('button:has-text("Sair")')
  143 | 
  144 |     // Verify successful logout
  145 |     await expect(page.locator('text=Login')).toBeVisible()
  146 | 
  147 |     // Try to access dashboard directly
  148 |     await page.goto('/')
  149 |     
  150 |     // Should still see login page
  151 |     await expect(page.locator('text=Login')).toBeVisible()
  152 |   })
  153 | })
  154 | 
```