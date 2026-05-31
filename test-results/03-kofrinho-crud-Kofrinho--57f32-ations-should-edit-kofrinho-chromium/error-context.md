# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-kofrinho-crud.spec.ts >> Kofrinho CRUD Operations >> should edit kofrinho
- Location: e2e/03-kofrinho-crud.spec.ts:71:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Editar")')
    3 × locator resolved to <button type="button" class="btn-secondary">Editar</button>
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
        - paragraph [ref=e11]: Test User 1780232470009
        - paragraph [ref=e12]: test-1780232470009@example.com
        - generic [ref=e13]:
          - generic [ref=e15]: Sem foto
          - button "Alterar foto" [ref=e17] [cursor=pointer]
    - main [ref=e18]:
      - generic [ref=e19]:
        - heading "Meus Kofrinhos" [level=2] [ref=e20]
        - generic [ref=e22]:
          - heading "Original Name" [level=3] [ref=e23]
          - paragraph [ref=e24]: Original description
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
  1   | import { test, expect } from './fixtures'
  2   | 
  3   | test.describe('Kofrinho CRUD Operations', () => {
  4   |   test('should create new kofrinho', async ({ page, authenticatedPage }) => {
  5   |     // Use authenticated page
  6   |     page = authenticatedPage
  7   | 
  8   |     // Scroll to create kofrinho section
  9   |     await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
  10  | 
  11  |     // Fill kofrinho form
  12  |     await page.fill('input[id="nome"]', 'Viagem de Férias')
  13  |     await page.fill('textarea[id="descricao"]', 'Economizar para viagem em 2026')
  14  | 
  15  |     // Submit
  16  |     await page.click('button:has-text("Criar Kofrinho")')
  17  | 
  18  |     // Wait for success message
  19  |     await expect(page.locator('text=sucesso')).toBeVisible()
  20  | 
  21  |     // Verify kofrinho appears in list
  22  |     await expect(page.locator('text=Viagem de Férias')).toBeVisible()
  23  |   })
  24  | 
  25  |   test('should list all kofrinhos', async ({ page, testUser }) => {
  26  |     // Register and login
  27  |     await page.goto('/')
  28  |     await page.click('button:has-text("Criar conta")')
  29  |     await page.fill('input[id="nome_completo"]', testUser.name)
  30  |     await page.fill('input[id="email"]', testUser.email)
  31  |     await page.fill('input[id="senha"]', testUser.password)
  32  |     await page.click('button[class="btn-primary"]:has-text("Criar Conta")')
  33  |     await page.waitForURL('/', { waitUntil: 'networkidle' })
  34  | 
  35  |     // Create multiple kofrinhos
  36  |     for (let i = 1; i <= 3; i++) {
  37  |       await page.locator('text=Criar Novo Kofrinho').scrollIntoViewIfNeeded()
  38  |       await page.fill('input[id="nome"]', `Kofrinho ${i}`)
  39  |       await page.fill('textarea[id="descricao"]', `Description ${i}`)
  40  |       await page.click('button:has-text("Criar Kofrinho")')
  41  |       await page.waitForTimeout(500)
  42  |     }
  43  | 
  44  |     // Verify all kofrinhos are listed
  45  |     for (let i = 1; i <= 3; i++) {
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
> 86  |     await page.click('button:has-text("Editar")')
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
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
  146 |     await expect(page.locator('text=obrigatório')).toBeVisible()
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