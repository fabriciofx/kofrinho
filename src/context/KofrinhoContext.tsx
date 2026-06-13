import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import * as api from '../api/client'

export interface Kofrinho {
  id: number
  nome: string
  descricao?: string | null
  user_id: number
  criado_em: string
}

interface KofrinhoContextType {
  kofrinhos: Kofrinho[]
  selectedKofrinho: Kofrinho | null
  loading: boolean
  error: string | null

  fetchKofrinhos: () => Promise<void>
  createKofrinho: (nome: string, descricao?: string) => Promise<void>
  selectKofrinho: (id: number) => Promise<void>
  updateKofrinho: (id: number, nome?: string, descricao?: string) => Promise<void>
  deleteKofrinho: (id: number) => Promise<void>
  clearSelected: () => void
}

const KofrinhoContext = createContext<KofrinhoContextType | undefined>(undefined)

export function KofrinhoProvider({ children }: { children: ReactNode }) {
  const [kofrinhos, setKofrinhos] = useState<Kofrinho[]>([])
  const [selectedKofrinho, setSelectedKofrinho] = useState<Kofrinho | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = () => setError(null)

  const fetchKofrinhos = async () => {
    clearError()
    setLoading(true)
    try {
      const data = await api.listKofrinhos()
      setKofrinhos(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar kofrinhos'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const createKofrinho = async (nome: string, descricao?: string) => {
    clearError()
    setLoading(true)
    try {
      const response = await api.createKofrinho(nome, descricao)
      if (response.kofrinho) {
        setKofrinhos([response.kofrinho, ...kofrinhos])
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar kofrinho'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const selectKofrinho = useCallback(async (id: number) => {
    setError(null)
    setLoading(true)
    try {
      const kofrinho = await api.getKofrinho(id)
      setSelectedKofrinho(kofrinho)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar kofrinho'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateKofrinho = async (id: number, nome?: string, descricao?: string) => {
    clearError()
    setLoading(true)
    try {
      const response = await api.updateKofrinho(id, nome, descricao)
      if (response.kofrinho) {
        setKofrinhos(kofrinhos.map(k => k.id === id ? response.kofrinho! : k))
        if (selectedKofrinho?.id === id) {
          setSelectedKofrinho(response.kofrinho)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar kofrinho'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const deleteKofrinho = async (id: number) => {
    clearError()
    setLoading(true)
    try {
      await api.deleteKofrinho(id)
      setKofrinhos(kofrinhos.filter(k => k.id !== id))
      if (selectedKofrinho?.id === id) {
        setSelectedKofrinho(null)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar kofrinho'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const clearSelected = () => {
    setSelectedKofrinho(null)
  }

  const value: KofrinhoContextType = {
    kofrinhos,
    selectedKofrinho,
    loading,
    error,

    fetchKofrinhos,
    createKofrinho,
    selectKofrinho,
    updateKofrinho,
    deleteKofrinho,
    clearSelected
  }

  return <KofrinhoContext.Provider value={value}>{children}</KofrinhoContext.Provider>
}

export function useKofrinho() {
  const context = useContext(KofrinhoContext)
  if (!context) {
    throw new Error('useKofrinho deve ser usado dentro de KofrinhoProvider')
  }
  return context
}
