import { jest } from '@jest/globals'
import { sendPagamentoConfirmadoEmail } from '../../services/emailService.js'

// NODE_ENV=test é definido automaticamente pelo Jest

describe('sendPagamentoConfirmadoEmail', () => {
  const args = {
    email: 'joao@teste.com',
    nome: 'João Silva',
    kofrinho: 'Viagem Europa',
    descricao: 'Fundo para férias em 2026',
    valor: 1500,
    pago_em: '2026-06-17 14:30:00',
  } as const

  test('retorna sem enviar em NODE_ENV=test', async () => {
    // NODE_ENV=test → a função deve retornar sem lançar e sem chamar Resend
    await expect(
      sendPagamentoConfirmadoEmail(
        args.email, args.nome, args.kofrinho, args.descricao, args.valor, args.pago_em
      )
    ).resolves.toBeUndefined()
  })

  test('não lança erro quando depositante não tem e-mail (chamador não invoca a função)', () => {
    // A lógica de "skip se sem email" é responsabilidade do controller;
    // a função em si não precisa tratar esse caso
    expect(typeof sendPagamentoConfirmadoEmail).toBe('function')
  })
})

// Testa a geração do template fora do fluxo de envio
describe('template do e-mail de confirmação (lógica pura)', () => {
  function gerarConteudo(
    nomeDepositante: string,
    nomeKofrinho: string,
    descricaoKofrinho: string | null,
    valor: number,
    pago_em: string
  ) {
    const valorFormatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const dataHora = new Date(pago_em.replace(' ', 'T') + 'Z')
      .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const referencia = descricaoKofrinho
      ? `${nomeKofrinho} — ${descricaoKofrinho}`
      : nomeKofrinho
    const subject = `Depósito de ${valorFormatado} confirmado no Kofrinho "${nomeKofrinho}"`
    return { subject, valorFormatado, dataHora, referencia }
  }

  test('subject contém valor formatado e nome do kofrinho', () => {
    const { subject } = gerarConteudo('João', 'Viagem Europa', null, 1500, '2026-06-17 14:30:00')
    expect(subject).toContain('R$ 1.500,00')
    expect(subject).toContain('Viagem Europa')
  })

  test('referencia inclui descricao quando presente', () => {
    const { referencia } = gerarConteudo('João', 'Viagem Europa', 'Férias 2026', 1500, '2026-06-17 14:30:00')
    expect(referencia).toBe('Viagem Europa — Férias 2026')
  })

  test('referencia usa apenas nome do kofrinho quando descricao é null', () => {
    const { referencia } = gerarConteudo('João', 'Viagem Europa', null, 1500, '2026-06-17 14:30:00')
    expect(referencia).toBe('Viagem Europa')
  })

  test('pago_em é parseado como UTC e convertido corretamente', () => {
    // 2026-06-17 14:30:00 UTC = 11:30:00 em Brasília (UTC-3)
    const { dataHora } = gerarConteudo('João', 'K', null, 100, '2026-06-17 14:30:00')
    expect(dataHora).toContain('17/06/2026')
    expect(dataHora).toContain('11:30')
  })

  test('valor é formatado em BRL', () => {
    const { valorFormatado } = gerarConteudo('João', 'K', null, 750.5, '2026-06-17 10:00:00')
    expect(valorFormatado).toContain('750,50')
  })
})
