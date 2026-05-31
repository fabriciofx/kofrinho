# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-avatar-upload.spec.ts >> Avatar Upload >> should show error on invalid file type
- Location: e2e/04-avatar-upload.spec.ts:88:3

# Error details

```
ReferenceError: __dirname is not defined
```

# Test source

```ts
  1   | import { test, expect } from './fixtures'
  2   | import path from 'path'
  3   | import fs from 'fs'
  4   | 
  5   | test.describe('Avatar Upload', () => {
  6   |   test.beforeAll(async () => {
  7   |     // Create a test image file
> 8   |     const testImagePath = path.join(__dirname, 'test-image.png')
      |                                     ^ ReferenceError: __dirname is not defined
  9   |     if (!fs.existsSync(testImagePath)) {
  10  |       // Create a simple 1x1 PNG image (smallest valid PNG)
  11  |       const pngBuffer = Buffer.from([
  12  |         0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  13  |         0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  14  |         0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  15  |         0x00, 0x00, 0x03, 0x00, 0x01, 0xa5, 0x3e, 0xde, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  16  |         0x44, 0xae, 0x42, 0x60, 0x82,
  17  |       ])
  18  |       fs.writeFileSync(testImagePath, pngBuffer)
  19  |     }
  20  |   })
  21  | 
  22  |   test('should upload avatar successfully', async ({ page, authenticatedPage }) => {
  23  |     page = authenticatedPage
  24  | 
  25  |     // Find avatar upload button
  26  |     const uploadButton = page.locator('button:has-text("Alterar foto")')
  27  |     await expect(uploadButton).toBeVisible()
  28  | 
  29  |     // Create a test image
  30  |     const testImagePath = path.join(__dirname, 'test-image.png')
  31  | 
  32  |     // Upload avatar
  33  |     const fileInput = page.locator('input[type="file"]')
  34  |     await fileInput.setInputFiles(testImagePath)
  35  | 
  36  |     // Wait for upload to complete
  37  |     await expect(page.locator('text=Removendo...')).not.toBeVisible()
  38  | 
  39  |     // Verify success message or avatar change
  40  |     await expect(page.locator('.avatar-image')).toBeVisible()
  41  |   })
  42  | 
  43  |   test('should show delete avatar button after upload', async ({ page, authenticatedPage }) => {
  44  |     page = authenticatedPage
  45  | 
  46  |     // Create and upload test image
  47  |     const testImagePath = path.join(__dirname, 'test-image.png')
  48  |     const fileInput = page.locator('input[type="file"]')
  49  |     await fileInput.setInputFiles(testImagePath)
  50  | 
  51  |     // Wait for upload
  52  |     await page.waitForTimeout(1000)
  53  | 
  54  |     // Verify delete button appears
  55  |     const deleteButton = page.locator('button:has-text("Remover foto")')
  56  |     await expect(deleteButton).toBeVisible()
  57  |   })
  58  | 
  59  |   test('should delete avatar', async ({ page, authenticatedPage }) => {
  60  |     page = authenticatedPage
  61  | 
  62  |     // Upload image first
  63  |     const testImagePath = path.join(__dirname, 'test-image.png')
  64  |     const fileInput = page.locator('input[type="file"]')
  65  |     await fileInput.setInputFiles(testImagePath)
  66  |     await page.waitForTimeout(1000)
  67  | 
  68  |     // Delete avatar
  69  |     await page.click('button:has-text("Remover foto")')
  70  | 
  71  |     // Handle confirmation if shown
  72  |     if (await page.locator('text=Deseja remover seu avatar').isVisible()) {
  73  |       // Click OK on confirmation
  74  |       const confirmButton = page.locator('button:has-text("OK"):visible').first()
  75  |       if (await confirmButton.isVisible()) {
  76  |         await confirmButton.click()
  77  |       }
  78  |     }
  79  | 
  80  |     // Wait for deletion
  81  |     await page.waitForTimeout(500)
  82  | 
  83  |     // Verify avatar placeholder is back or delete button is gone
  84  |     const deleteButton = page.locator('button:has-text("Remover foto")')
  85  |     await expect(deleteButton).not.toBeVisible()
  86  |   })
  87  | 
  88  |   test('should show error on invalid file type', async ({ page, authenticatedPage }) => {
  89  |     page = authenticatedPage
  90  | 
  91  |     // Create a test text file (invalid)
  92  |     const testFilePath = path.join(__dirname, 'test-file.txt')
  93  |     fs.writeFileSync(testFilePath, 'This is not an image')
  94  | 
  95  |     // Try to upload invalid file
  96  |     const fileInput = page.locator('input[type="file"]')
  97  |     await fileInput.setInputFiles(testFilePath)
  98  | 
  99  |     // Wait for validation
  100 |     await page.waitForTimeout(500)
  101 | 
  102 |     // Verify error message
  103 |     const errorMsg = page.locator('text=JPEG, PNG')
  104 |     if (await errorMsg.isVisible()) {
  105 |       await expect(errorMsg).toBeVisible()
  106 |     }
  107 | 
  108 |     // Clean up
```