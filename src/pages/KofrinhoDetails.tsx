import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKofrinho } from '../context/KofrinhoContext'
import '../styles/KofrinhoDetails.css'

function KofrinhoDetails() {
  const navigate = useNavigate()
  const { kofrinho, adicionarValor, resgatarValor } = useKofrinho()
  const [valorAdicionar, setValorAdicionar] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [valorResgate, setValorResgate] = useState(0)

  if (!kofrinho) {
    return (
      <section id="kofrinho-details-empty">
        <div className="empty-state">
          <h2>Nenhum Kofrinho Selecionado</h2>
          <p>Crie um novo kofrinho para começar</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/')}
          >
            Voltar para Home
          </button>
        </div>
      </section>
    )
  }

  const handleAdicionarValor = () => {
    setMensagem('')
    const valor = parseFloat(valorAdicionar)

    if (!valorAdicionar || isNaN(valor) || valor <= 0) {
      setMensagem('Digite um valor positivo')
      return
    }

    try {
      adicionarValor(valor)
      setMensagem(`R$ ${valor.toFixed(2)} adicionado com sucesso!`)
      setValorAdicionar('')
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Erro ao adicionar valor')
    }
  }

  const handleResgatar = () => {
    const saldoResgatado = resgatarValor()
    setValorResgate(saldoResgatado)
    setMensagem(`Resgate de R$ ${saldoResgatado.toFixed(2)} realizado com sucesso!`)
  }

  return (
    <section id="kofrinho-details">
      <button
        type="button"
        className="btn-back"
        onClick={() => navigate('/')}
      >
        ← Voltar
      </button>

      <div className="kofrinho-card">
        <h2>Informações do Kofrinho</h2>
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
          <h3>Adicionar Valor</h3>
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

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}
    </section>
  )
}

export default KofrinhoDetails
