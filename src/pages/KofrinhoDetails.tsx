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

// Datas do SQLite vêm como 'YYYY-MM-DD HH:MM:SS' em UTC, sem marcador de fuso.
// Adiciona 'Z' para parse correto e exibe no horário de Brasília.
function formatarDataBrasilia(data: string): string {
  const iso = data.includes('T') ? data : data.replace(' ', 'T') + 'Z'
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function KofrinhoDetails() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { selectedKofrinho, depositantes, solicitacoes, loading, error, selectKofrinho, fetchDepositantes, deleteDepositante, fetchSolicitacoes } = useKofrinho()
  const [editingDepositante, setEditingDepositante] = useState<Depositante | null>(null)
  const [creatingDepositante, setCreatingDepositante] = useState(false)

  useEffect(() => {
    if (id) {
      selectKofrinho(parseInt(id))
      fetchDepositantes(parseInt(id))
      fetchSolicitacoes(parseInt(id))
    }
  }, [id, selectKofrinho, fetchDepositantes, fetchSolicitacoes])

  // SSE: atualiza "Solicitações" e o saldo em tempo real quando uma solicitação muda
  useEffect(() => {
    if (!id) return
    const kofrinhoId = parseInt(id)
    const controller = new AbortController()
    let reconnectTimeout: ReturnType<typeof setTimeout>

    async function conectar() {
      try {
        const tokens = getStoredTokens()
        if (!tokens?.token) return

        const res = await fetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/solicitacoes/eventos`, {
          headers: { Authorization: `Bearer ${tokens.token}` },
          signal: controller.signal,
        })
        if (!res.ok || !res.body) return

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (decoder.decode(value).includes('solicitacao_')) {
            fetchSolicitacoes(kofrinhoId)
            // recarrega o kofrinho para refletir o saldo (soma das pagas) ao vivo
            selectKofrinho(kofrinhoId)
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
  }, [id, fetchSolicitacoes, selectKofrinho])

  const pageHeader = (
    <header className="details-header">
      <h1>Kofrinho - Seu Cofre Digital</h1>
      <button type="button" className="btn-voltar" onClick={() => navigate('/')}>
        ← Voltar
      </button>
    </header>
  )

  if (!id) {
    return (
      <div className="details-page">
        {pageHeader}
        <div id="kofrinho-details-empty">
          <div className="empty-state">
            <h2>Nenhum Kofrinho Selecionado</h2>
            <p>Crie um novo kofrinho para começar</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="details-page">
        {pageHeader}
        <div id="kofrinho-details-empty">
          <div className="empty-state">
            <h2>Erro ao carregar Kofrinho</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!selectedKofrinho && !loading) {
    return (
      <div className="details-page">
        {pageHeader}
        <div id="kofrinho-details-empty">
          <div className="empty-state">
            <h2>Kofrinho não encontrado</h2>
            <p>Este kofrinho não existe ou foi deletado</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="details-page">
      {pageHeader}

      <section id="kofrinho-details">
        {selectedKofrinho && (
          <header className="kofrinho-details-title">
            <h1>{selectedKofrinho.nome}</h1>
            {selectedKofrinho.descricao && <p>{selectedKofrinho.descricao}</p>}
            <div className="kofrinho-details-saldo">
              <span className="kofrinho-details-saldo-label">Saldo</span>
              <span className="kofrinho-details-saldo-valor">
                {selectedKofrinho.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </header>
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

        <div className="solicitacoes-section">
          <h2>Solicitações</h2>

          {solicitacoes.length === 0 ? (
            <p className="solicitacoes-empty">Nenhuma solicitação cadastrada ainda.</p>
          ) : (
            <table className="solicitacoes-table">
              <thead>
                <tr>
                  <th>Depositante</th>
                  <th>Valor</th>
                  <th>Data</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.map((p) => (
                  <tr key={p.id}>
                    <td>{p.depositante_nome}</td>
                    <td>{p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>{formatarDataBrasilia(p.criado_em)}</td>
                    <td>
                      <span
                        className={`situacao-badge ${p.pago === 1 ? 'situacao-paga' : 'situacao-a-pagar'}`}
                      >
                        {p.pago === 1 ? 'Paga' : 'A Pagar'}
                      </span>
                    </td>
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
    </div>
  )
}

export default KofrinhoDetails
