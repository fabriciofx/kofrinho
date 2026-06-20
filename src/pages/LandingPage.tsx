import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import '../styles/Landing.css'
import '../styles/Auth.css'

export default function LandingPage() {
  const location = useLocation()
  const { login, register, requestPasswordReset, loading, error } = useAuth()

  const [loginOpen, setLoginOpen] = useState<boolean>(() => location.state?.openLogin === true)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const [loginData, setLoginData] = useState({ email: '', senha: '' })
  const [registerData, setRegisterData] = useState({ nome_completo: '', email: '', senha: '' })
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotMessage, setForgotMessage] = useState<string | null>(null)

  function abrirLogin() { setRegisterOpen(false); setForgotOpen(false); setLoginOpen(true) }
  function abrirRegister() { setLoginOpen(false); setForgotOpen(false); setRegisterOpen(true) }
  function abrirForgot() { setLoginOpen(false); setRegisterOpen(false); setForgotOpen(true) }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(loginData.email, loginData.senha)
    } catch {
      // error handled by context
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await register(registerData.nome_completo, registerData.email, registerData.senha)
    } catch {
      // error handled by context
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await requestPasswordReset(forgotEmail)
      setForgotMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
      setTimeout(() => {
        setForgotOpen(false)
        setForgotMessage(null)
        setForgotEmail('')
        abrirLogin()
      }, 3000)
    } catch {
      // error handled by context
    }
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-brand">
          <img src="/kofrinho.png" alt="Logo Kofrinho" className="landing-brand-logo" />
          <span className="landing-brand-name">Kofrinho</span>
        </div>
        <nav className="landing-nav">
          <button className="btn-landing-login" onClick={abrirLogin}>Login</button>
          <button className="btn-landing-register" onClick={abrirRegister}>Criar Conta</button>
        </nav>
      </header>

      <section className="landing-hero">
        <img src="/kofrinho.png" alt="Kofrinho" className="landing-hero-logo" />
        <h1 className="landing-hero-title">Seu Cofre Digital Pessoal</h1>
        <p className="landing-hero-subtitle">
          Organize suas economias em kofrinhos, cadastre depositantes recorrentes
          e acompanhe seu saldo atualizado em tempo real.
        </p>
        <div className="landing-cta">
          <button className="btn-cta-primary" onClick={abrirRegister}>
            Criar Conta Grátis
          </button>
          <button className="btn-cta-secondary" onClick={abrirLogin}>
            Já tenho conta
          </button>
        </div>
      </section>

      <section className="landing-features">
        <div className="feature-card">
          <span className="feature-icon">📦</span>
          <h3>Kofrinhos</h3>
          <p>Crie categorias de poupança personalizadas para cada objetivo financeiro.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">👥</span>
          <h3>Depositantes</h3>
          <p>Cadastre pessoas que contribuem com depósitos recorrentes e envie cobranças via Pix.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">📊</span>
          <h3>Saldo em Tempo Real</h3>
          <p>Acompanhe o saldo de cada kofrinho atualizado ao vivo conforme os pagamentos chegam.</p>
        </div>
      </section>

      {/* ── Modal de Login ─────────────────────────────── */}
      <Modal isOpen={loginOpen} onClose={() => setLoginOpen(false)} title="Login">
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={loginData.email}
              onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))}
              required
              placeholder="seu@email.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={loginData.senha}
              onChange={e => setLoginData(p => ({ ...p, senha: e.target.value }))}
              required
              placeholder="Sua senha"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <div className="auth-links">
            <button type="button" className="link-button" onClick={abrirForgot}>
              Esqueceu a senha?
            </button>
            <button type="button" className="link-button" onClick={abrirRegister}>
              Criar conta
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal de Cadastro ───────────────────────────── */}
      <Modal isOpen={registerOpen} onClose={() => setRegisterOpen(false)} title="Criar Conta">
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label htmlFor="nome_completo">Nome Completo</label>
            <input
              id="nome_completo"
              type="text"
              value={registerData.nome_completo}
              onChange={e => setRegisterData(p => ({ ...p, nome_completo: e.target.value }))}
              required
              placeholder="Seu nome"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={registerData.email}
              onChange={e => setRegisterData(p => ({ ...p, email: e.target.value }))}
              required
              placeholder="seu@email.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={registerData.senha}
              onChange={e => setRegisterData(p => ({ ...p, senha: e.target.value }))}
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
            <button type="button" className="link-button" onClick={abrirLogin}>
              Já tem conta? Entrar
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Modal de Recuperação de Senha ───────────────── */}
      <Modal isOpen={forgotOpen} onClose={() => setForgotOpen(false)} title="Recuperar Senha">
        {error && <div className="error-message">{error}</div>}
        {forgotMessage && <div className="success-message">{forgotMessage}</div>}
        <form onSubmit={handleForgot} className="auth-form">
          <div className="form-group">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Enviando...' : 'Enviar E-mail de Recuperação'}
          </button>
          <div className="auth-links">
            <button type="button" className="link-button" onClick={abrirLogin}>
              Voltar ao login
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
