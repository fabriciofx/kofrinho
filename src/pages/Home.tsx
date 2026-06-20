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
import '../styles/Auth.css'
import '../styles/Dashboard.css'

export default function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated, loading, error, login, register, logout, requestPasswordReset } = useAuth()
  const { kofrinhos, fetchKofrinhos, deleteKofrinho, loading: kofrinhoLoading } = useKofrinho()
  const [mode, setMode] = useState<'login' | 'register' | 'profile' | 'forgot' | 'dashboard'>('login')
  const [formData, setFormData] = useState({
    email: '',
    senha: '',
    nome_completo: ''
  })
  const [message, setMessage] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [depositanteKofrinhoId, setDepositanteKofrinhoId] = useState<number | null>(null)
  const [editingKofrinho, setEditingKofrinho] = useState<Kofrinho | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      setMode('dashboard')
      fetchKofrinhos()
    }
  }, [isAuthenticated])

  // Mantém a referência mais recente de fetchKofrinhos (não é memoizada no contexto)
  const fetchKofrinhosRef = useRef(fetchKofrinhos)
  useEffect(() => { fetchKofrinhosRef.current = fetchKofrinhos })

  // SSE: atualiza o saldo dos cards do dashboard ao vivo (uma conexão por usuário)
  useEffect(() => {
    if (!isAuthenticated || mode !== 'dashboard') return
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
  }, [isAuthenticated, mode])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      await login(formData.email, formData.senha)
      setFormData({ email: '', senha: '', nome_completo: '' })
    } catch (err) {
      // Error is handled by useAuth
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      await register(formData.nome_completo, formData.email, formData.senha)
      setFormData({ email: '', senha: '', nome_completo: '' })
    } catch (err) {
      // Error is handled by useAuth
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    try {
      await requestPasswordReset(formData.email)
      setMessage('Email de recuperação enviado! Verifique sua caixa de entrada.')
      setFormData({ email: '', senha: '', nome_completo: '' })
      setTimeout(() => setMode('login'), 3000)
    } catch (err) {
      // Error is handled by useAuth
    }
  }

  const handleLogout = () => {
    logout()
    setMode('login')
    setFormData({ email: '', senha: '', nome_completo: '' })
    setMessage(null)
  }

  const handleDeleteKofrinho = async (id: number) => {
    if (!confirm('Tem certeza que deseja deletar este kofrinho?')) return
    try {
      await deleteKofrinho(id)
    } catch (err) {
      // Error handled by context
    }
  }

  if (isAuthenticated && mode === 'dashboard') {
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

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>Kofrinho - Seu Cofre Digital</h1>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <h2>Login</h2>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="seu@email.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type="password"
                name="senha"
                value={formData.senha}
                onChange={handleChange}
                required
                placeholder="Sua senha"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="auth-links">
              <button
                type="button"
                onClick={() => { setMode('register'); setFormData({ email: '', senha: '', nome_completo: '' }) }}
                className="link-button"
              >
                Criar conta
              </button>
              <button
                type="button"
                onClick={() => { setMode('forgot'); setFormData({ email: '', senha: '', nome_completo: '' }) }}
                className="link-button"
              >
                Esqueceu a senha?
              </button>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="auth-form">
            <h2>Criar Conta</h2>

            <div className="form-group">
              <label htmlFor="nome_completo">Nome Completo</label>
              <input
                id="nome_completo"
                type="text"
                name="nome_completo"
                value={formData.nome_completo}
                onChange={handleChange}
                required
                placeholder="Seu nome"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="seu@email.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="senha">Senha</label>
              <input
                id="senha"
                type="password"
                name="senha"
                value={formData.senha}
                onChange={handleChange}
                required
                placeholder="Mínimo 8 caracteres com maiúsculas, minúsculas, números e caracteres especiais"
              />
              <small className="password-hint">
                Requisitos: 8+ caracteres, maiúscula, minúscula, número, caractere especial
              </small>
            </div>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Criando...' : 'Criar Conta'}
            </button>

            <div className="auth-links">
              <button
                type="button"
                onClick={() => { setMode('login'); setFormData({ email: '', senha: '', nome_completo: '' }) }}
                className="link-button"
              >
                Já tem conta? Entrar
              </button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <h2>Recuperar Senha</h2>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="seu@email.com"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Enviando...' : 'Enviar Email de Recuperação'}
            </button>

            <div className="auth-links">
              <button
                type="button"
                onClick={() => { setMode('login'); setFormData({ email: '', senha: '', nome_completo: '' }) }}
                className="link-button"
              >
                Voltar ao login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
