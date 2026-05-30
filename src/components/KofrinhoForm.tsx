import { useState } from 'react'
import Kofrinho from '../models/Kofrinho'
import '../styles/KofrinhoForm.css'

function KofrinhoForm() {
  const [usuario, setUsuario] = useState('')
  const [nome, setNome] = useState('')
  const [saldo, setSaldo] = useState('')
  const [kofrinho, setKofrinho] = useState<Kofrinho | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [valorAdicionar, setValorAdicionar] = useState('')
  const [valorResgate, setValorResgate] = useState(0)

  const handleCadastro = (e: React.FormEvent) => {
    e.preventDefault()
    setMensagem('')

    if (!usuario.trim() || !nome.trim()) {
      setMensagem('Usuário e nome são obrigatórios')
      return
    }

    const saldoNumerico = saldo ? parseFloat(saldo) : 0
    if (saldo && (isNaN(saldoNumerico) || saldoNumerico < 0)) {
      setMensagem('Valor deve ser um número positivo')
      return
    }

    try {
      const novoKofrinho = new Kofrinho(
        usuario.trim(),
        nome.trim(),
        new Date(),
        saldoNumerico
      )
      setKofrinho(novoKofrinho)
      setMensagem(`Kofrinho "${nome}" criado com sucesso!`)
      setUsuario('')
      setNome('')
      setSaldo('')
      setValorAdicionar('')
      setValorResgate(0)
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : 'Erro ao criar kofrinho'
      )
    }
  }

  const handleAdicionarValor = () => {
    if (!kofrinho) {
      setMensagem('Crie um kofrinho primeiro')
      return
    }

    setMensagem('')
    const valor = parseFloat(valorAdicionar)

    if (!valorAdicionar || isNaN(valor) || valor <= 0) {
      setMensagem('Digite um valor positivo')
      return
    }

    try {
      const novoKofrinho = kofrinho.adicionarValor(valor)
      setKofrinho(novoKofrinho)
      setMensagem(`R$ ${valor.toFixed(2)} adicionado com sucesso!`)
      setValorAdicionar('')
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao adicionar valor')
    }
  }

  const handleResgatar = () => {
    if (!kofrinho) {
      setMensagem('Crie um kofrinho primeiro')
      return
    }

    const { saldo: saldoResgatado, novoKofrinho } = kofrinho.resgatarValor()
    setKofrinho(novoKofrinho)
    setValorResgate(saldoResgatado)
    setMensagem(`Resgate de R$ ${saldoResgatado.toFixed(2)} realizado com sucesso!`)
  }

  return (
    <div className="kofrinho-container">
      <div className="kofrinho-form-section">
        <h2>Cadastrar Kofrinho</h2>
        <form onSubmit={handleCadastro}>
          <div className="form-group">
            <label htmlFor="usuario">Usuário *</label>
            <input
              id="usuario"
              type="text"
              placeholder="Digite o nome do usuário"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="nome">Nome do Kofrinho *</label>
            <input
              id="nome"
              type="text"
              placeholder="Digite o nome do kofrinho"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="saldo">Valor Inicial (R$)</label>
            <input
              id="saldo"
              type="number"
              placeholder="0.00"
              value={saldo}
              onChange={(e) => setSaldo(e.target.value)}
              step="0.01"
              min="0"
            />
          </div>

          <button type="submit" className="btn-primary">
            Criar Kofrinho
          </button>
        </form>
      </div>

      {kofrinho && (
        <div className="kofrinho-display-section">
          <div className="kofrinho-card">
            <h3>Informações do Kofrinho</h3>
            <div className="info-group">
              <span className="label">Usuário:</span>
              <span className="value">{kofrinho.usuario}</span>
            </div>
            <div className="info-group">
              <span className="label">Nome:</span>
              <span className="value">{kofrinho.nome}</span>
            </div>
            <div className="info-group">
              <span className="label">Data de Criação:</span>
              <span className="value">
                {kofrinho.dataCriacao.toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="info-group highlight">
              <span className="label">Saldo Atual:</span>
              <span className="value-highlight">
                R$ {kofrinho.valor().toFixed(2)}
              </span>
            </div>
          </div>

          <div className="kofrinho-actions-section">
            <div className="action-group">
              <h4>Adicionar Valor</h4>
              <div className="input-group">
                <input
                  type="number"
                  placeholder="Digite o valor"
                  value={valorAdicionar}
                  onChange={(e) => setValorAdicionar(e.target.value)}
                  step="0.01"
                  min="0"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleAdicionarValor}
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="action-group">
              <button
                type="button"
                className="btn-danger"
                onClick={handleResgatar}
              >
                Resgatar Tudo
              </button>
              {valorResgate > 0 && (
                <p className="resgate-info">
                  Último resgate: R$ {valorResgate.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}
    </div>
  )
}

export default KofrinhoForm
