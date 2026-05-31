import { test, expect } from './fixtures'
import path from 'path'
import fs from 'fs'

test.describe('Avatar Upload', () => {
  const getTestImagePath = () => {
    return path.join(process.cwd(), 'e2e', 'test-image.png')
  }

  test.beforeAll(async () => {
    // Create a test image file
    const testImagePath = getTestImagePath()
    if (!fs.existsSync(testImagePath)) {
      // Create a simple 1x1 PNG image (smallest valid PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0xa5, 0x3e, 0xde, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
        0x44, 0xae, 0x42, 0x60, 0x82,
      ])
      fs.writeFileSync(testImagePath, pngBuffer)
    }
  })

  test('should upload avatar successfully', async ({ page, authenticatedPage }) => {
    page = authenticatedPage

    // Find avatar upload button
    const uploadButton = page.locator('button:has-text("Alterar foto")')
    await expect(uploadButton).toBeVisible()

    // Upload avatar
    const testImagePath = getTestImagePath()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testImagePath)

    // Wait for upload to complete
    await expect(page.locator('text=Removendo...')).not.toBeVisible()

    // Verify success message or avatar change
    await expect(page.locator('.avatar-image')).toBeVisible()
  })

  test('should show delete avatar button after upload', async ({ page, authenticatedPage }) => {
    page = authenticatedPage

    // Create and upload test image
    const testImagePath = getTestImagePath()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testImagePath)

    // Wait for upload
    await page.waitForTimeout(1000)

    // Verify delete button appears
    const deleteButton = page.locator('button:has-text("Remover foto")')
    await expect(deleteButton).toBeVisible()
  })

  test('should delete avatar', async ({ page, authenticatedPage }) => {
    page = authenticatedPage

    // Upload image first
    const testImagePath = getTestImagePath()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(testImagePath)
    await page.waitForTimeout(1000)

    // Delete avatar
    await page.click('button:has-text("Remover foto")')

    // Handle confirmation if shown
    if (await page.locator('text=Deseja remover seu avatar').isVisible()) {
      const confirmButton = page.locator('button:has-text("OK"):visible').first()
      if (await confirmButton.isVisible()) {
        await confirmButton.click()
      }
    }

    // Wait for deletion
    await page.waitForTimeout(500)

    // Verify avatar placeholder is back or delete button is gone
    const deleteButton = page.locator('button:has-text("Remover foto")')
    await expect(deleteButton).not.toBeVisible()
  })
})
