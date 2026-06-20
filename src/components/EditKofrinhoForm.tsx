import { useState } from 'react'
import { useKofrinho, type Kofrinho } from '../context/KofrinhoContext'
import '../styles/KofrinhoForm.css'

interface EditKofrinhoFormProps {
  kofrinho: Kofrinho
  onSuccess?: () => void
}

function EditKofrinhoForm({ kofrinho, onSuccess }: EditKofrinhoFormProps) {
  const { updateKofrinho, loading } = useKofrinho()
  const [nome, setNome] = useState(kofrinho.nome)
  const [descricao, setDescricao] = useState(kofrinho.descricao ?? '')
  const [mensagem, setMensagem] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensagem('')

    if (!nome.trim()) {
      setMensagem('Nome do kofrinho é obrigatório')
      return
    }

    try {
      await updateKofrinho(kofrinho.id, nome.trim(), descricao.trim())
      setMensagem('Kofrinho atualizado com sucesso!')
      if (onSuccess) setTimeout(() => onSuccess(), 1200)
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao atualizar kofrinho')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="kofrinho-form modal-form">
      <div className="form-group">
        <label htmlFor="edit-kofrinho-nome">Nome do Kofrinho *</label>
        <input
          id="edit-kofrinho-nome"
          type="text"
          placeholder="Ex: Viagem, Carro, Investimento"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="edit-kofrinho-descricao">Descrição (opcional)</label>
        <textarea
          id="edit-kofrinho-descricao"
          placeholder="Descreva para que serve este kofrinho"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar Alterações'}
      </button>

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}
    </form>
  )
}

export default EditKofrinhoForm
