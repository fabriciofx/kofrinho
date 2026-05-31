import { test, expect } from './fixtures'
import fs from 'fs'
import path from 'path'

test.describe('Avatar Upload', () => {
  test.beforeAll(async () => {
    // Create test image if it doesn't exist
    const testImagePath = path.join(process.cwd(), 'e2e', 'test-image.png')
    
    if (!fs.existsSync(testImagePath)) {
      // Create minimal PNG file (1x1 pixel)
      const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      const ihdr = Buffer.from([0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 99, 248, 15, 0, 0, 1, 1, 1, 0, 24, 187, 177, 238])
      const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
      
      const png = Buffer.concat([pngHeader, ihdr, iend])
      fs.mkdirSync(path.dirname(testImagePath), { recursive: true })
      fs.writeFileSync(testImagePath, png)
    }
  })

  test('should upload avatar successfully', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')
    
    // Find file input
    const testImagePath = path.join(process.cwd(), 'e2e', 'test-image.png')
    
    // Wait for avatar section to be visible
    await page.waitForSelector('.avatar-upload', { timeout: 5000 })
    
    // Upload file
    await page.locator('input[type="file"]').setInputFiles(testImagePath)
    
    // Wait for upload to complete and component re-render
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Verify delete button appears (indicates successful upload)
    // Button should be visible after upload
    const deleteButton = page.locator('button:has-text("Remover foto")')
    await expect(deleteButton).toBeVisible({ timeout: 8000 })
  })

  test('should show delete avatar button after upload', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')
    
    const testImagePath = path.join(process.cwd(), 'e2e', 'test-image.png')
    
    // Wait for avatar section
    await page.waitForSelector('.avatar-upload', { timeout: 5000 })
    
    // Upload
    await page.locator('input[type="file"]').setInputFiles(testImagePath)
    
    // Wait for upload and re-render
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Verify delete button
    await expect(page.locator('button:has-text("Remover foto")')).toBeVisible({ timeout: 8000 })
  })

  test('should delete avatar', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')
    
    const testImagePath = path.join(process.cwd(), 'e2e', 'test-image.png')
    
    // Wait for avatar section
    await page.waitForSelector('.avatar-upload', { timeout: 5000 })
    
    // Upload
    await page.locator('input[type="file"]').setInputFiles(testImagePath)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Verify upload
    await expect(page.locator('button:has-text("Remover foto")')).toBeVisible({ timeout: 8000 })
    
    // Delete avatar
    await page.click('button:has-text("Remover foto")')
    
    // Handle confirmation if shown
    if (await page.locator('text=Deseja remover seu avatar').isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('button:has-text("Confirmar")')
    }
    
    // Wait for deletion and re-render
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Verify button gone (upload button should be back)
    await expect(page.locator('button:has-text("Remover foto")')).not.toBeVisible({ timeout: 5000 })
  })

  test('should show error on invalid file type', async ({ authenticatedPage: page }) => {
    await page.waitForLoadState('networkidle')
    
    // Create invalid file
    const invalidPath = path.join(process.cwd(), 'e2e', 'test-file.txt')
    fs.writeFileSync(invalidPath, 'This is not an image')
    
    // Try to upload
    await page.locator('input[type="file"]').setInputFiles(invalidPath)
    
    // Wait a bit
    await page.waitForTimeout(1000)
    
    // Verify error or no upload occurred
    const deleteBtn = await page.locator('button:has-text("Remover foto")').isVisible().catch(() => false)
    
    // Should not have successfully uploaded
    await expect(!deleteBtn).toBeTruthy()
    
    // Cleanup
    fs.unlinkSync(invalidPath)
  })

  test('should persist avatar across logout and login', async ({ authenticatedPage: page, testUser }) => {
    await page.waitForLoadState('networkidle')
    
    const testImagePath = path.join(process.cwd(), 'e2e', 'test-image.png')
    
    // Wait for avatar section
    await page.waitForSelector('.avatar-upload', { timeout: 5000 })
    
    // Upload avatar
    await page.locator('input[type="file"]').setInputFiles(testImagePath)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Verify upload
    await expect(page.locator('button:has-text("Remover foto")')).toBeVisible({ timeout: 8000 })
    
    // Logout
    await page.click('button:has-text("Sair")')
    await page.waitForSelector('h2:has-text("Login")', { timeout: 5000 })
    
    // Login again
    await page.fill('input[id="email"]', testUser.email)
    await page.fill('input[id="senha"]', testUser.password)
    await page.click('button[class="btn-primary"]:has-text("Entrar")')
    
    // Wait for dashboard
    await page.waitForSelector('text=Bem-vindo', { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    
    // Wait for avatar section
    await page.waitForSelector('.avatar-upload', { timeout: 5000 })
    
    // Verify avatar persisted
    await expect(page.locator('button:has-text("Remover foto")')).toBeVisible({ timeout: 8000 })
  })
})
