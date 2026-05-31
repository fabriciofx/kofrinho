# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-avatar-upload.spec.ts >> Avatar Upload >> should persist avatar across logout and login
- Location: e2e/04-avatar-upload.spec.ts:118:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Remover foto")')
Expected: visible
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 8000ms
  - waiting for locator('button:has-text("Remover foto")')

```

```yaml
- banner:
  - heading "Kofrinho - Seu Cofre Digital" [level=1]
  - button "Sair"
- complementary:
  - heading "Bem-vindo!" [level=3]
  - paragraph: Test User 1780233531408
  - paragraph: test1780233531408@example.com
  - text: Sem foto
  - button "Alterar foto"
  - text: Erro interno do servidor
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
  32  |     await page.locator('input[type="file"]').setInputFiles(testImagePath)
  33  |     
  34  |     // Wait for upload to complete and component re-render
  35  |     await page.waitForLoadState('networkidle')
  36  |     await page.waitForTimeout(1500)
  37  |     
  38  |     // Verify delete button appears (indicates successful upload)
  39  |     // Button should be visible after upload
  40  |     const deleteButton = page.locator('button:has-text("Remover foto")')
  41  |     await expect(deleteButton).toBeVisible({ timeout: 8000 })
  42  |   })
  43  | 
  44  |   test('should show delete avatar button after upload', async ({ authenticatedPage: page }) => {
  45  |     await page.waitForLoadState('networkidle')
  46  |     
  47  |     const testImagePath = path.join(process.cwd(), 'e2e', 'test-image.png')
  48  |     
  49  |     // Wait for avatar section
  50  |     await page.waitForSelector('.avatar-upload', { timeout: 5000 })
  51  |     
  52  |     // Upload
  53  |     await page.locator('input[type="file"]').setInputFiles(testImagePath)
  54  |     
  55  |     // Wait for upload and re-render
  56  |     await page.waitForLoadState('networkidle')
  57  |     await page.waitForTimeout(1500)
  58  |     
  59  |     // Verify delete button
  60  |     await expect(page.locator('button:has-text("Remover foto")')).toBeVisible({ timeout: 8000 })
  61  |   })
  62  | 
  63  |   test('should delete avatar', async ({ authenticatedPage: page }) => {
  64  |     await page.waitForLoadState('networkidle')
  65  |     
  66  |     const testImagePath = path.join(process.cwd(), 'e2e', 'test-image.png')
  67  |     
  68  |     // Wait for avatar section
  69  |     await page.waitForSelector('.avatar-upload', { timeout: 5000 })
  70  |     
  71  |     // Upload
  72  |     await page.locator('input[type="file"]').setInputFiles(testImagePath)
  73  |     await page.waitForLoadState('networkidle')
  74  |     await page.waitForTimeout(1500)
  75  |     
  76  |     // Verify upload
  77  |     await expect(page.locator('button:has-text("Remover foto")')).toBeVisible({ timeout: 8000 })
  78  |     
  79  |     // Delete avatar
  80  |     await page.click('button:has-text("Remover foto")')
  81  |     
  82  |     // Handle confirmation if shown
  83  |     if (await page.locator('text=Deseja remover seu avatar').isVisible({ timeout: 2000 }).catch(() => false)) {
  84  |       await page.click('button:has-text("Confirmar")')
  85  |     }
  86  |     
  87  |     // Wait for deletion and re-render
  88  |     await page.waitForLoadState('networkidle')
  89  |     await page.waitForTimeout(1000)
  90  |     
  91  |     // Verify button gone (upload button should be back)
  92  |     await expect(page.locator('button:has-text("Remover foto")')).not.toBeVisible({ timeout: 5000 })
  93  |   })
  94  | 
  95  |   test('should show error on invalid file type', async ({ authenticatedPage: page }) => {
  96  |     await page.waitForLoadState('networkidle')
  97  |     
  98  |     // Create invalid file
  99  |     const invalidPath = path.join(process.cwd(), 'e2e', 'test-file.txt')
  100 |     fs.writeFileSync(invalidPath, 'This is not an image')
  101 |     
  102 |     // Try to upload
  103 |     await page.locator('input[type="file"]').setInputFiles(invalidPath)
  104 |     
  105 |     // Wait a bit
  106 |     await page.waitForTimeout(1000)
  107 |     
  108 |     // Verify error or no upload occurred
  109 |     const deleteBtn = await page.locator('button:has-text("Remover foto")').isVisible().catch(() => false)
  110 |     
  111 |     // Should not have successfully uploaded
  112 |     await expect(!deleteBtn).toBeTruthy()
  113 |     
  114 |     // Cleanup
  115 |     fs.unlinkSync(invalidPath)
  116 |   })
  117 | 
  118 |   test('should persist avatar across logout and login', async ({ authenticatedPage: page, testUser }) => {
  119 |     await page.waitForLoadState('networkidle')
  120 |     
  121 |     const testImagePath = path.join(process.cwd(), 'e2e', 'test-image.png')
  122 |     
  123 |     // Wait for avatar section
  124 |     await page.waitForSelector('.avatar-upload', { timeout: 5000 })
  125 |     
  126 |     // Upload avatar
  127 |     await page.locator('input[type="file"]').setInputFiles(testImagePath)
  128 |     await page.waitForLoadState('networkidle')
  129 |     await page.waitForTimeout(1500)
  130 |     
  131 |     // Verify upload
> 132 |     await expect(page.locator('button:has-text("Remover foto")')).toBeVisible({ timeout: 8000 })
      |                                                                   ^ Error: expect(locator).toBeVisible() failed
  133 |     
  134 |     // Logout
  135 |     await page.click('button:has-text("Sair")')
  136 |     await page.waitForSelector('h2:has-text("Login")', { timeout: 5000 })
  137 |     
  138 |     // Login again
  139 |     await page.fill('input[id="email"]', testUser.email)
  140 |     await page.fill('input[id="senha"]', testUser.password)
  141 |     await page.click('button[class="btn-primary"]:has-text("Entrar")')
  142 |     
  143 |     // Wait for dashboard
  144 |     await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })
  145 |     await page.waitForLoadState('networkidle')
  146 |     
  147 |     // Wait for avatar section
  148 |     await page.waitForSelector('.avatar-upload', { timeout: 5000 })
  149 |     
  150 |     // Verify avatar persisted
  151 |     await expect(page.locator('button:has-text("Remover foto")')).toBeVisible({ timeout: 8000 })
  152 |   })
  153 | })
  154 | 
```