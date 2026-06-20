import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useKofrinho, type Kofrinho } from '../context/KofrinhoContext'
import { API_BASE_URL, getStoredTokens } from '../api/client'
import { AvatarUpload } from '../components/AvatarUpload'
import KofrinhoForm from '../components/KofrinhoForm'
import EditKofrinhoForm from '../components/EditKofrinhoForm'
import DepositanteForm from '../components/DepositanteForm'
import { Modal } from '../components/Modal'
import '../styles/Dashboard.css'

export default function Home() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { kofrinhos, fetchKofrinhos, deleteKofrinho, loading: kofrinhoLoading } = useKofrinho()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [depositanteKofrinhoId, setDepositanteKofrinhoId] = useState<number | null>(null)
  const [editingKofrinho, setEditingKofrinho] = useState<Kofrinho | null>(null)

  useEffect(() => {
    fetchKofrinhos()
  }, [])

  // Mantém a referência mais recente de fetchKofrinhos (não é memoizada no contexto)
  const fetchKofrinhosRef = useRef(fetchKofrinhos)
  useEffect(() => { fetchKofrinhosRef.current = fetchKofrinhos })

  // SSE: atualiza o saldo dos cards do dashboard ao vivo (uma conexão por usuário)
  useEffect(() => {
    const tokens = getStoredTokens()
    if (!tokens?.token) return

    const controller = new AbortController()
    let reconnectTimeout: ReturnType<typeof setTimeout>

    async function conectar() {
      try {
        const res = await fetch(`${API_BASE_URL}/kofrinhos/eventos`, {
          headers: { Authorization: `Bearer ${tokens!.token}` },
          signal: controller.signal,
        })
        if (!res.ok || !res.body) return

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (decoder.decode(value).includes('saldo_atualizado')) {
            fetchKofrinhosRef.current()
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
  }, [])

  const handleLogout = () => {
    logout()
    // Sinaliza para a LandingPage que deve abrir o modal de login
    navigate('/', { state: { openLogin: true } })
  }

  const handleDeleteKofrinho = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar este kofrinho?')) return
    try {
      await deleteKofrinho(id)
    } catch {
      // Error handled by context
    }
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Kofrinho - Seu Cofre Digital</h1>
        <button onClick={handleLogout} className="btn-logout">
          Sair
        </button>
      </header>

      <div className="dashboard-content">
        <aside className="dashboard-sidebar">
          <div className="profile-card">
            <h3>Bem-vindo!</h3>
            <p className="user-name">{user?.nome_completo}</p>
            <p className="user-email">{user?.email}</p>
            <AvatarUpload />
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="kofrinhos-section">
            <div className="kofrinhos-header">
              <h2>Meus Kofrinhos</h2>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-create-kofrinho"
              >
                + Criar novo Kofrinho
              </button>
            </div>

            {kofrinhoLoading && <p>Carregando kofrinhos...</p>}

            {kofrinhos.length === 0 && !kofrinhoLoading ? (
              <div className="empty-state">
                <p>Você ainda não tem kofrinhos. Crie um novo!</p>
              </div>
            ) : (
              <div className="kofrinhos-grid">
                {kofrinhos.map(kofrinho => (
                  <div key={kofrinho.id} className="kofrinho-card">
                    <div className="kofrinho-card-top">
                      <h3>{kofrinho.nome}</h3>
                      <button
                        type="button"
                        className="btn-icon-edit-card"
                        title="Editar kofrinho"
                        onClick={() => setEditingKofrinho(kofrinho)}
                      >
                        ✏️
                      </button>
                    </div>
                    {kofrinho.descricao && <p className="descricao">{kofrinho.descricao}</p>}
                    <p className="criado-em">
                      Criado em: {new Date(kofrinho.criado_em).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="kofrinho-saldo">
                      <span className="kofrinho-saldo-label">Saldo</span>
                      <span className="kofrinho-saldo-valor">
                        {kofrinho.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </p>
                    <div className="card-actions">
                      <button
                        onClick={() => navigate(`/kofrinho/${kofrinho.id}`)}
                        className="btn-view"
                      >
                        Ver Detalhes
                      </button>
                      <button
                        onClick={() => setDepositanteKofrinhoId(kofrinho.id)}
                        className="btn-depositante"
                      >
                        Criar Depositante
                      </button>
                      <button
                        onClick={() => handleDeleteKofrinho(kofrinho.id)}
                        className="btn-delete-small"
                      >
                        Deletar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Criar novo Kofrinho"
          >
            <KofrinhoForm isModal={true} onSuccess={() => setIsModalOpen(false)} />
          </Modal>

          <Modal
            isOpen={editingKofrinho !== null}
            onClose={() => setEditingKofrinho(null)}
            title="Editar Kofrinho"
          >
            {editingKofrinho && (
              <EditKofrinhoForm
                kofrinho={editingKofrinho}
                onSuccess={() => setEditingKofrinho(null)}
              />
            )}
          </Modal>

          <Modal
            isOpen={depositanteKofrinhoId !== null}
            onClose={() => setDepositanteKofrinhoId(null)}
            title="Criar Depositante"
          >
            {depositanteKofrinhoId !== null && (
              <DepositanteForm
                kofrinhoId={depositanteKofrinhoId}
                onSuccess={() => setDepositanteKofrinhoId(null)}
              />
            )}
          </Modal>
        </main>
      </div>
    </div>
  )
}
