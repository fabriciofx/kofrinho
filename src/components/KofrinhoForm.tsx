import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKofrinho } from '../context/KofrinhoContext'
import Kofrinho from '../models/Kofrinho'
import '../styles/KofrinhoForm.css'

function KofrinhoForm() {
  const navigate = useNavigate()
  const { setKofrinho } = useKofrinho()
  const [usuario, setUsuario] = useState('')
  const [nome, setNome] = useState('')
  const [saldo, setSaldo] = useState('')
  const [mensagem, setMensagem] = useState('')

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
      navigate('/kofrinho')
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : 'Erro ao criar kofrinho'
      )
    }
  }

  return (
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

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}
    </div>
  )
}

export default KofrinhoForm
