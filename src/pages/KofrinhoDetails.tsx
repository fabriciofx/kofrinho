import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useKofrinho, type Depositante } from '../context/KofrinhoContext'
import { Modal } from '../components/Modal'
import DepositanteForm from '../components/DepositanteForm'
import EditDepositanteForm from '../components/EditDepositanteForm'
import { API_BASE_URL, getStoredTokens } from '../api/client'
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
  const { selectedKofrinho, depositantes, pagamentos, loading, error, selectKofrinho, updateKofrinho, deleteKofrinho, fetchDepositantes, deleteDepositante, fetchPagamentos } = useKofrinho()
  const [descricao, setDescricao] = useState('')
  const [nome, setNome] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editingDepositante, setEditingDepositante] = useState<Depositante | null>(null)
  const [creatingDepositante, setCreatingDepositante] = useState(false)

  useEffect(() => {
    if (id) {
      selectKofrinho(parseInt(id))
      fetchDepositantes(parseInt(id))
      fetchPagamentos(parseInt(id))
    }
  }, [id, selectKofrinho, fetchDepositantes, fetchPagamentos])

  // SSE: atualiza "Solicitações" em tempo real quando um pagamento é confirmado
  useEffect(() => {
    if (!id) return
    const kofrinhoId = parseInt(id)
    const controller = new AbortController()
    let reconnectTimeout: ReturnType<typeof setTimeout>

    async function conectar() {
      try {
        const tokens = getStoredTokens()
        if (!tokens?.token) return

        const res = await fetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/pagamentos/eventos`, {
          headers: { Authorization: `Bearer ${tokens.token}` },
          signal: controller.signal,
        })
        if (!res.ok || !res.body) return

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (decoder.decode(value).includes('pagamento_confirmado')) {
            fetchPagamentos(kofrinhoId)
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          reconnectTimeout = setTimeout(conectar, 5000)
        }
      }
    }

    conectar()
    return () => {
      controller.abort()
      clearTimeout(reconnectTimeout)
    }
  }, [id, fetchPagamentos])

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
        <div className="kofrinho-card-header">
          <h2>Informações do Kofrinho</h2>
          {!isEditing && selectedKofrinho && (
            <div className="kofrinho-card-icons">
              <button
                type="button"
                className="btn-icon-kofrinho btn-icon-edit"
                title="Editar kofrinho"
                onClick={() => setIsEditing(true)}
              >
                ✏️
              </button>
              <button
                type="button"
                className="btn-icon-kofrinho btn-icon-delete"
                title="Deletar kofrinho"
                onClick={handleDelete}
                disabled={loading}
              >
                🗑
              </button>
            </div>
          )}
        </div>

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
          <div className="kofrinho-info-row">
            <div className="kofrinho-info-col">
              <span className="info-label">Nome</span>
              <span className="info-value">{selectedKofrinho!.nome}</span>
            </div>
            {selectedKofrinho!.descricao && (
              <div className="kofrinho-info-col">
                <span className="info-label">Descrição</span>
                <span className="info-value">{selectedKofrinho!.descricao}</span>
              </div>
            )}
            <div className="kofrinho-info-col">
              <span className="info-label">Criado em</span>
              <span className="info-value">
                {new Date(selectedKofrinho!.criado_em).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        )}
      </div>

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}

      <div className="depositantes-section">
        <div className="depositantes-section-header">
          <h2>Depositantes</h2>
          <button
            type="button"
            className="btn-primary btn-novo-depositante"
            onClick={() => setCreatingDepositante(true)}
          >
            + Novo depositante
          </button>
        </div>

        {depositantes.length === 0 ? (
          <p className="depositantes-empty">Nenhum depositante cadastrado ainda.</p>
        ) : (
          <table className="depositantes-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Valor</th>
                <th>Recorrência</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {depositantes.map((d) => (
                <tr key={d.id}>
                  <td>{d.nome}</td>
                  <td>
                    {d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td>{RECORRENCIA_LABEL[d.recorrencia] ?? d.recorrencia}</td>
                  <td className="depositante-contact">{d.email ?? '—'}</td>
                  <td className="depositante-contact">{d.telefone ?? '—'}</td>
                  <td className="depositante-actions">
                    <button
                      className="btn-edit-depositante"
                      title="Editar depositante"
                      onClick={() => setEditingDepositante(d)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-delete-depositante"
                      title="Remover depositante"
                      onClick={async () => {
                        if (!confirm('Remover este depositante?')) return
                        try {
                          await deleteDepositante(selectedKofrinho!.id, d.id)
                        } catch {
                          /* error already set in context */
                        }
                      }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pagamentos-section">
        <h2>Solicitações</h2>

        {pagamentos.length === 0 ? (
          <p className="pagamentos-empty">Nenhuma solicitação cadastrada ainda.</p>
        ) : (
          <table className="pagamentos-table">
            <thead>
              <tr>
                <th>Depositante</th>
                <th>Valor</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map((p) => (
                <tr key={p.id}>
                  <td>{p.depositante_nome}</td>
                  <td>{p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{p.pago_em ? new Date(p.pago_em).toLocaleString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={creatingDepositante}
        onClose={() => setCreatingDepositante(false)}
        title="Novo Depositante"
      >
        {selectedKofrinho && (
          <DepositanteForm
            kofrinhoId={selectedKofrinho.id}
            onSuccess={() => {
              setCreatingDepositante(false)
              fetchDepositantes(selectedKofrinho.id)
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={editingDepositante !== null}
        onClose={() => setEditingDepositante(null)}
        title="Editar Depositante"
      >
        {editingDepositante && (
          <EditDepositanteForm
            kofrinhoId={selectedKofrinho!.id}
            depositante={editingDepositante}
            onSuccess={() => setEditingDepositante(null)}
          />
        )}
      </Modal>
    </section>
  )
}

export default KofrinhoDetails
