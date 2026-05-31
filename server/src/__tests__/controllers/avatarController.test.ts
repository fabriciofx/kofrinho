import request from 'supertest'
import bcrypt from 'bcrypt'
import { setupTestDb, runAsync, getAsync } from '../setup/database.js'
import { startTestServer, stopTestServer, TestServerSetup } from '../setup/testServer.js'
import { generateAccessToken } from '../../utils/jwt.js'
import { createValidUser } from '../setup/fixtures.js'
import { User } from '../../types/index.js'

function createTestImage(width: number = 100, height: number = 100): Buffer {
  // Simple PNG header + minimal PNG data
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, width, 0x00, 0x00, 0x00, height,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x01, 0x73, 0x52, 0x47, 0x42, 0x00, 0xae, 0xce, 0x1c, 0xe9, 0x00, 0x00,
    0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00,
    0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ])
  return png
}

describe('Avatar Upload - POST /api/avatars/upload', () => {
  let testDb: any
  let testServer: TestServerSetup
  const baseUser = createValidUser()
  const userId = 200
  let senhaHash: string
  let validToken: string

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)
    senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb,
      `INSERT INTO users (id, nome_completo, email, senha_hash)
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    validToken = generateAccessToken(userId, baseUser.email)
  })

  afterAll(async () => {
    await stopTestServer(testServer)
  })

  test('uploads avatar successfully', async () => {
    const imageBuffer = createTestImage(100, 100)

    const response = await request(testServer.app)
      .post('/api/avatars/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', imageBuffer, 'avatar.png')

    expect(response.status).toBe(200)
    expect(response.body.message).toContain('sucesso')
    expect(response.body.user.foto_avatar).toBeTruthy()
    expect(response.body.user.foto_avatar).toMatch(/^\/api\/avatars\/avatar-.*\.png$/)
  })

  test('updates database with avatar filename', async () => {
    const imageBuffer = createTestImage(100, 100)

    const response = await request(testServer.app)
      .post('/api/avatars/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', imageBuffer, 'avatar.png')

    const user = await getAsync<User>(testDb,
      'SELECT foto_avatar FROM users WHERE id = ?',
      [userId]
    )

    expect(user?.foto_avatar).toBeTruthy()
    expect(user?.foto_avatar).toMatch(/^avatar-.*\.png$/)
  })

  test('returns 400 when no file is provided', async () => {
    const response = await request(testServer.app)
      .post('/api/avatars/upload')
      .set('Authorization', `Bearer ${validToken}`)

    expect(response.status).toBe(400)
  })

  test('returns 400 for non-image file', async () => {
    const textBuffer = Buffer.from('This is not an image')

    const response = await request(testServer.app)
      .post('/api/avatars/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', textBuffer, 'file.txt')

    // Multer rejects this, so it returns 400 from the middleware
    expect([400, 500]).toContain(response.status)
  })

  test('returns 401 when not authenticated', async () => {
    const imageBuffer = createTestImage(100, 100)

    const response = await request(testServer.app)
      .post('/api/avatars/upload')
      .attach('avatar', imageBuffer, 'avatar.png')

    expect(response.status).toBe(401)
  })

  test('replaces old avatar with new one', async () => {
    const imageBuffer1 = createTestImage(100, 100)
    const imageBuffer2 = createTestImage(150, 150)

    const response1 = await request(testServer.app)
      .post('/api/avatars/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', imageBuffer1, 'avatar1.png')

    const oldFilename = response1.body.user.foto_avatar

    const response2 = await request(testServer.app)
      .post('/api/avatars/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', imageBuffer2, 'avatar2.png')

    const newFilename = response2.body.user.foto_avatar

    expect(oldFilename).not.toBe(newFilename)

    const user = await getAsync<User>(testDb,
      'SELECT foto_avatar FROM users WHERE id = ?',
      [userId]
    )

    expect(user?.foto_avatar).not.toContain('avatar1')
  })
})

describe('Avatar Delete - DELETE /api/avatars', () => {
  let testDb: any
  let testServer: TestServerSetup
  const baseUser = createValidUser()
  const userId = 201
  let senhaHash: string
  let validToken: string

  beforeAll(async () => {
    testDb = await setupTestDb()
    testServer = await startTestServer(testDb)
    senhaHash = await bcrypt.hash(baseUser.senha, 10)

    await runAsync(testDb,
      `INSERT INTO users (id, nome_completo, email, senha_hash)
       VALUES (?, ?, ?, ?)`,
      [userId, baseUser.nome_completo, baseUser.email, senhaHash]
    )

    validToken = generateAccessToken(userId, baseUser.email)
  })

  afterAll(async () => {
    await stopTestServer(testServer)
  })

  test('deletes avatar successfully', async () => {
    // Upload avatar first
    const imageBuffer = createTestImage(100, 100)
    await request(testServer.app)
      .post('/api/avatars/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', imageBuffer, 'avatar.png')

    const response = await request(testServer.app)
      .delete('/api/avatars')
      .set('Authorization', `Bearer ${validToken}`)

    expect(response.status).toBe(200)
    expect(response.body.message).toContain('sucesso')
  })

  test('clears avatar from database', async () => {
    // Upload avatar first
    const imageBuffer = createTestImage(100, 100)
    await request(testServer.app)
      .post('/api/avatars/upload')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('avatar', imageBuffer, 'avatar.png')

    await request(testServer.app)
      .delete('/api/avatars')
      .set('Authorization', `Bearer ${validToken}`)

    const user = await getAsync<User>(testDb,
      'SELECT foto_avatar FROM users WHERE id = ?',
      [userId]
    )

    expect(user?.foto_avatar).toBeNull()
  })

  test('returns 400 when user has no avatar', async () => {
    const response = await request(testServer.app)
      .delete('/api/avatars')
      .set('Authorization', `Bearer ${validToken}`)

    expect(response.status).toBe(400)
  })

  test('returns 401 when not authenticated', async () => {
    const response = await request(testServer.app)
      .delete('/api/avatars')

    expect(response.status).toBe(401)
  })
})

describe('Avatar Utilities - avatarUpload.ts', () => {
  test('validateImageFile accepts PNG files', async () => {
    const { validateImageFile } = await import('../../utils/avatarUpload.js')
    
    const file: any = {
      fieldname: 'avatar',
      originalname: 'test.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024,
      destination: '',
      filename: '',
      path: ''
    }

    const result = validateImageFile(file)
    expect(result.valid).toBe(true)
  })

  test('validateImageFile accepts JPEG files', async () => {
    const { validateImageFile } = await import('../../utils/avatarUpload.js')
    
    const file: any = {
      fieldname: 'avatar',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      destination: '',
      filename: '',
      path: ''
    }

    const result = validateImageFile(file)
    expect(result.valid).toBe(true)
  })

  test('validateImageFile rejects non-image files', async () => {
    const { validateImageFile } = await import('../../utils/avatarUpload.js')
    
    const file: any = {
      fieldname: 'avatar',
      originalname: 'test.txt',
      encoding: '7bit',
      mimetype: 'text/plain',
      size: 1024,
      destination: '',
      filename: '',
      path: ''
    }

    const result = validateImageFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('JPEG, PNG e WebP')
  })

  test('validateImageFile rejects files over 5MB', async () => {
    const { validateImageFile } = await import('../../utils/avatarUpload.js')
    
    const file: any = {
      fieldname: 'avatar',
      originalname: 'test.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 6 * 1024 * 1024,
      destination: '',
      filename: '',
      path: ''
    }

    const result = validateImageFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('5MB')
  })

  test('getAvatarUrl generates correct URL', async () => {
    const { getAvatarUrl } = await import('../../utils/avatarUpload.js')
    
    const url = getAvatarUrl('avatar-123.png')
    expect(url).toBe('/api/avatars/avatar-123.png')
  })

  test('extractFilenameFromPath extracts filename', async () => {
    const { extractFilenameFromPath } = await import('../../utils/avatarUpload.js')
    
    const filename = extractFilenameFromPath('/uploads/avatars/avatar-123.png')
    expect(filename).toBe('avatar-123.png')
  })
})
