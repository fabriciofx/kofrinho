# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-kofrinho-crud.spec.ts >> Kofrinho CRUD Operations >> should show error on missing kofrinho name
- Location: e2e/03-kofrinho-crud.spec.ts:135:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=obrigatório')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=obrigatório')

```

```yaml
- banner:
  - heading "Kofrinho - Seu Cofre Digital" [level=1]
  - button "Sair"
- complementary:
  - heading "Bem-vindo!" [level=3]
  - paragraph: Test User 1780232472060
  - paragraph: test-1780232472060@example.com
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
    - text: Some description
  - button "Criar Kofrinho"
```

# Test source

```ts
  46  |       await expect(page.locator(`text=Kofrinho ${i}`)).toBeVisible()
  47  |     }
  48  |   })
  49  | 
  50  |   test('should view kofrinho details', async ({ page, authenticatedPage }) => {
  51  |     page = authenticatedPage
  52  | 
  53  |     // Create a kofrinho
  54  |     await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
  55  |     await page.fill('input[id="nome"]', 'Carro Novo')
  56  |     await page.fill('textarea[id="descricao"]', 'Economizar para comprar carro')
  57  |     await page.click('button:has-text("Criar Kofrinho")')
  58  |     await page.waitForTimeout(500)
  59  | 
  60  |     // Click "Ver Detalhes"
  61  |     await page.click('button:has-text("Ver Detalhes")')
  62  | 
  63  |     // Wait for details page to load
  64  |     await page.waitForURL(/\/kofrinho\/\d+/)
  65  | 
  66  |     // Verify kofrinho details are shown
  67  |     await expect(page.locator('text=Carro Novo')).toBeVisible()
  68  |     await expect(page.locator('text=Economizar para comprar carro')).toBeVisible()
  69  |   })
  70  | 
  71  |   test('should edit kofrinho', async ({ page, authenticatedPage }) => {
  72  |     page = authenticatedPage
  73  | 
  74  |     // Create a kofrinho
  75  |     await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
  76  |     await page.fill('input[id="nome"]', 'Original Name')
  77  |     await page.fill('textarea[id="descricao"]', 'Original description')
  78  |     await page.click('button:has-text("Criar Kofrinho")')
  79  |     await page.waitForTimeout(500)
  80  | 
  81  |     // Navigate to details
  82  |     await page.click('button:has-text("Ver Detalhes")')
  83  |     await page.waitForURL(/\/kofrinho\/\d+/)
  84  | 
  85  |     // Click Edit
  86  |     await page.click('button:has-text("Editar")')
  87  | 
  88  |     // Verify form is now editable
  89  |     await expect(page.locator('input[id="nome"]')).toHaveValue('Original Name')
  90  | 
  91  |     // Update fields
  92  |     await page.fill('input[id="nome"]', 'Updated Name')
  93  |     await page.fill('textarea[id="descricao"]', 'Updated description')
  94  | 
  95  |     // Save
  96  |     await page.click('button:has-text("Salvar")')
  97  | 
  98  |     // Wait for success message
  99  |     await expect(page.locator('text=sucesso')).toBeVisible()
  100 | 
  101 |     // Verify updated data is displayed
  102 |     await expect(page.locator('text=Updated Name')).toBeVisible()
  103 |     await expect(page.locator('text=Updated description')).toBeVisible()
  104 |   })
  105 | 
  106 |   test('should delete kofrinho', async ({ page, authenticatedPage }) => {
  107 |     page = authenticatedPage
  108 | 
  109 |     // Create a kofrinho
  110 |     await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
  111 |     await page.fill('input[id="nome"]', 'To Delete')
  112 |     await page.fill('textarea[id="descricao"]', 'This will be deleted')
  113 |     await page.click('button:has-text("Criar Kofrinho")')
  114 |     await page.waitForTimeout(500)
  115 | 
  116 |     // Verify kofrinho is in list
  117 |     await expect(page.locator('text=To Delete')).toBeVisible()
  118 | 
  119 |     // Click Delete on dashboard
  120 |     const kofrinhoCard = page.locator('text=To Delete').locator('..')
  121 |     await kofrinhoCard.locator('button:has-text("Deletar")').click()
  122 | 
  123 |     // Confirm deletion if dialog appears
  124 |     if (await page.locator('text=Tem certeza').isVisible()) {
  125 |       await page.click('button:has-text("Deletar")')
  126 |     }
  127 | 
  128 |     // Wait for success message
  129 |     await expect(page.locator('text=sucesso')).toBeVisible()
  130 | 
  131 |     // Verify kofrinho is removed from list
  132 |     await expect(page.locator('text=To Delete')).not.toBeVisible()
  133 |   })
  134 | 
  135 |   test('should show error on missing kofrinho name', async ({ page, authenticatedPage }) => {
  136 |     page = authenticatedPage
  137 | 
  138 |     // Scroll to create kofrinho section
  139 |     await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
  140 | 
  141 |     // Try to submit without name
  142 |     await page.fill('textarea[id="descricao"]', 'Some description')
  143 |     await page.click('button:has-text("Criar Kofrinho")')
  144 | 
  145 |     // Verify error message
> 146 |     await expect(page.locator('text=obrigatório')).toBeVisible()
      |                                                    ^ Error: expect(locator).toBeVisible() failed
  147 |   })
  148 | 
  149 |   test('should cancel edit and revert changes', async ({ page, authenticatedPage }) => {
  150 |     page = authenticatedPage
  151 | 
  152 |     // Create a kofrinho
  153 |     await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
  154 |     await page.fill('input[id="nome"]', 'Original Name')
  155 |     await page.fill('textarea[id="descricao"]', 'Original description')
  156 |     await page.click('button:has-text("Criar Kofrinho")')
  157 |     await page.waitForTimeout(500)
  158 | 
  159 |     // Navigate to details
  160 |     await page.click('button:has-text("Ver Detalhes")')
  161 |     await page.waitForURL(/\/kofrinho\/\d+/)
  162 | 
  163 |     // Click Edit
  164 |     await page.click('button:has-text("Editar")')
  165 | 
  166 |     // Change fields
  167 |     await page.fill('input[id="nome"]', 'Changed Name')
  168 | 
  169 |     // Click Cancel
  170 |     await page.click('button:has-text("Cancelar")')
  171 | 
  172 |     // Verify original data is shown
  173 |     await expect(page.locator('text=Original Name')).toBeVisible()
  174 |     await expect(page.locator('text=Changed Name')).not.toBeVisible()
  175 |   })
  176 | })
  177 | 
```