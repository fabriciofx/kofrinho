import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import * as api from '../api/client'

export interface User {
  id: number
  nome_completo: string
  email: string
  foto_avatar?: string | null
  criado_em?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean

  register: (nome_completo: string, email: string, senha: string) => Promise<void>
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (token: string, novaSenha: string) => Promise<void>
  uploadAvatar: (file: File) => Promise<void>
  deleteAvatar: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if user is already logged in on mount
  useEffect(() => {
    const tokens = api.getStoredTokens()
    if (tokens) {
      // In a real app, you'd validate the token with the backend
      // For now, we'll just restore the user if we can
      // This is a simplified approach
    }
  }, [])

  const clearError = () => setError(null)

  const register = async (nome_completo: string, email: string, senha: string) => {
    clearError()
    setLoading(true)
    try {
      const response = await api.register(nome_completo, email, senha)
      setUser(response.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, senha: string) => {
    clearError()
    setLoading(true)
    try {
      const response = await api.login(email, senha)
      setUser(response.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    api.setStoredTokens(null)
    setUser(null)
    clearError()
  }

  const requestPasswordReset = async (email: string) => {
    clearError()
    setLoading(true)
    try {
      await api.requestPasswordReset(email)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao solicitar recuperação'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (token: string, novaSenha: string) => {
    clearError()
    setLoading(true)
    try {
      await api.resetPassword(token, novaSenha)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao redefinir senha'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const uploadAvatar = async (file: File) => {
    clearError()
    setLoading(true)
    try {
      const response = await api.uploadAvatar(file)
      setUser(response.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar avatar'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const deleteAvatar = async () => {
    clearError()
    setLoading(true)
    try {
      const response = await api.deleteAvatar()
      setUser(response.user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover avatar'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAuthenticated: user !== null && api.getStoredTokens() !== null,

    register,
    login,
    logout,
    requestPasswordReset,
    resetPassword,
    uploadAvatar,
    deleteAvatar
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}
