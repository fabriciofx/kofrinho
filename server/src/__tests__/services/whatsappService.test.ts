import { normalizarTelefoneBr, sendWhatsApp } from '../../services/whatsappService.js'

// NODE_ENV=test é definido automaticamente pelo Jest

describe('normalizarTelefoneBr', () => {
  test('remove máscara e prefixa o código do país', () => {
    expect(normalizarTelefoneBr('(11) 98765-4321')).toBe('5511987654321')
  })

  test('mantém número nacional sem máscara e prefixa 55', () => {
    expect(normalizarTelefoneBr('11987654321')).toBe('5511987654321')
  })

  test('não duplica o código do país quando já presente', () => {
    expect(normalizarTelefoneBr('+55 11 98765-4321')).toBe('5511987654321')
  })

  test('aceita telefone fixo (10 dígitos) e prefixa 55', () => {
    expect(normalizarTelefoneBr('(11) 3456-7890')).toBe('551134567890')
  })

  test('retorna null quando não há dígitos suficientes', () => {
    expect(normalizarTelefoneBr('123')).toBeNull()
    expect(normalizarTelefoneBr('')).toBeNull()
  })
})

describe('sendWhatsApp', () => {
  test('retorna sem enviar em NODE_ENV=test', async () => {
    await expect(
      sendWhatsApp({ to: '(11) 98765-4321', body: 'Olá' })
    ).resolves.toBeUndefined()
  })

  test('ignora telefone inválido sem lançar', async () => {
    await expect(
      sendWhatsApp({ to: 'abc', body: 'Olá' })
    ).resolves.toBeUndefined()
  })
})
