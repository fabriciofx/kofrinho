import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useKofrinho } from '../context/KofrinhoContext'
import '../styles/KofrinhoDetails.css'

const RECORRENCIA_LABEL: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
}

function KofrinhoDetails() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { selectedKofrinho, depositos, loading, error, selectKofrinho, updateKofrinho, deleteKofrinho, fetchDepositos } = useKofrinho()
  const [descricao, setDescricao] = useState('')
  const [nome, setNome] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (id) {
      selectKofrinho(parseInt(id))
      fetchDepositos(parseInt(id))
    }
  }, [id, selectKofrinho, fetchDepositos])

  useEffect(() => {
    if (selectedKofrinho) {
      setNome(selectedKofrinho.nome)
      setDescricao(selectedKofrinho.descricao || '')
    }
  }, [selectedKofrinho])

  if (!id) {
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

  if (error) {
    return (
      <section id="kofrinho-details-empty">
        <div className="empty-state">
          <h2>Erro ao carregar Kofrinho</h2>
          <p>{error}</p>
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

  if (!selectedKofrinho && !loading) {
    return (
      <section id="kofrinho-details-empty">
        <div className="empty-state">
          <h2>Kofrinho não encontrado</h2>
          <p>Este kofrinho não existe ou foi deletado</p>
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

  const handleSave = async () => {
    if (!selectedKofrinho) return
    setMensagem('')
    try {
      await updateKofrinho(selectedKofrinho.id, nome, descricao)
      setMensagem('Kofrinho atualizado com sucesso!')
      setIsEditing(false)
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao atualizar kofrinho')
    }
  }

  const handleDelete = async () => {
    if (!selectedKofrinho) return
    if (!confirm('Tem certeza que deseja deletar este kofrinho?')) return

    setMensagem('')
    try {
      await deleteKofrinho(selectedKofrinho.id)
      setMensagem('Kofrinho deletado com sucesso!')
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao deletar kofrinho')
    }
  }

  const handleCancel = () => {
    if (!selectedKofrinho) return
    setIsEditing(false)
    setNome(selectedKofrinho.nome)
    setDescricao(selectedKofrinho.descricao || '')
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

        {loading ? (
          <div className="loading-state">
            <p>Carregando informações do kofrinho...</p>
          </div>
        ) : !selectedKofrinho ? (
          <div className="empty-state">
            <p>Nenhum kofrinho selecionado</p>
          </div>
        ) : isEditing ? (
          <>
            <div className="form-group">
              <label htmlFor="nome">Nome</label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do kofrinho"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="descricao">Descrição</label>
              <textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição (opcional)"
                rows={3}
              />
            </div>

            <div className="action-buttons">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="info-group">
              <span className="label">Nome:</span>
              <span className="value">{selectedKofrinho!.nome}</span>
            </div>
            {selectedKofrinho!.descricao && (
              <div className="info-group">
                <span className="label">Descrição:</span>
                <span className="value">{selectedKofrinho!.descricao}</span>
              </div>
            )}
            <div className="info-group">
              <span className="label">Data de Criação:</span>
              <span className="value">
                {new Date(selectedKofrinho!.criado_em).toLocaleDateString('pt-BR')}
              </span>
            </div>

            <div className="action-buttons">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsEditing(true)}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Deletando...' : 'Deletar'}
              </button>
            </div>
          </>
        )}
      </div>

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}

      <div className="depositos-section">
        <h2>Depósitos</h2>

        {depositos.length === 0 ? (
          <p className="depositos-empty">Nenhum depósito cadastrado ainda.</p>
        ) : (
          <table className="depositos-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Valor</th>
                <th>Recorrência</th>
              </tr>
            </thead>
            <tbody>
              {depositos.map((d) => (
                <tr key={d.id}>
                  <td>{d.nome}</td>
                  <td>
                    {d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td>{RECORRENCIA_LABEL[d.recorrencia] ?? d.recorrencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

export default KofrinhoDetails
