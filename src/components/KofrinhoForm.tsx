import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useKofrinho } from '../context/KofrinhoContext'
import '../styles/KofrinhoForm.css'

interface KofrinhoFormProps {
  onSuccess?: () => void
  isModal?: boolean
}

function KofrinhoForm({ onSuccess, isModal = false }: KofrinhoFormProps) {
  const navigate = useNavigate()
  const { createKofrinho, loading, error } = useKofrinho()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [mensagem, setMensagem] = useState('')

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensagem('')

    if (!nome.trim()) {
      setMensagem('Nome do kofrinho é obrigatório')
      return
    }

    try {
      await createKofrinho(nome.trim(), descricao.trim() || undefined)
      setMensagem('Kofrinho criado com sucesso!')
      setNome('')
      setDescricao('')
      
      if (isModal && onSuccess) {
        setTimeout(() => onSuccess(), 1200)
      } else {
        setTimeout(() => navigate('/'), 2000)
      }
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao criar kofrinho')
    }
  }

  return (
    <form onSubmit={handleCadastro} className={`kofrinho-form ${isModal ? 'modal-form' : ''}`}>
      <div className="form-group">
        <label htmlFor="nome">Nome do Kofrinho *</label>
        <input
          id="nome"
          type="text"
          placeholder="Ex: Viagem, Carro, Investimento"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="descricao">Descrição (opcional)</label>
        <textarea
          id="descricao"
          placeholder="Descreva para que serve este kofrinho"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Criando...' : 'Criar Kofrinho'}
      </button>

      {error && <div className="mensagem erro">{error}</div>}
      {mensagem && <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>{mensagem}</div>}
    </form>
  )
}

export default KofrinhoForm

