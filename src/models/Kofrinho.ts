/*
 * Kofrinho - Money box entity
 * Holds user savings with creation date and amount tracking
 */

class Kofrinho {
  readonly usuario: string
  readonly nome: string
  readonly dataCriacao: Date
  private saldo: number

  constructor(usuario: string, nome: string, dataCriacao: Date, saldo: number = 0) {
    this.usuario = usuario
    this.nome = nome
    this.dataCriacao = dataCriacao
    this.saldo = saldo
  }

  valor(): number {
    return this.saldo
  }

  adicionarValor(valor: number): Kofrinho {
    if (valor <= 0) {
      throw new Error('Valor deve ser maior que zero')
    }
    return new Kofrinho(this.usuario, this.nome, this.dataCriacao, this.saldo + valor)
  }

  resgatarValor(): { saldo: number; novoKofrinho: Kofrinho } {
    const saldoResgatado = this.saldo
    const novoKofrinho = new Kofrinho(this.usuario, this.nome, this.dataCriacao, 0)
    return { saldo: saldoResgatado, novoKofrinho }
  }
}

export default Kofrinho
