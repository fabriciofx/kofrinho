import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import * as api from '../api/client'

export interface Kofrinho {
  id: number
  nome: string
  descricao?: string | null
  user_id: number
  criado_em: string
}

export interface Solicitacao {
  id: number
  solicitacao_id: string
  kofrinho_id: number
  depositante_id: number
  depositante_nome: string
  valor: number
  pago: number
  pago_em: string | null
  criado_em: string
}

export interface Depositante {
  id: number
  kofrinho_id: number
  nome: string
  valor: number
  recorrencia: 'anual' | 'mensal' | 'semanal' | 'diario'
  email: string | null
  telefone: string | null
  data_inicio: string | null
  criado_em: string
}

interface KofrinhoContextType {
  kofrinhos: Kofrinho[]
  selectedKofrinho: Kofrinho | null
  depositantes: Depositante[]
  solicitacoes: Solicitacao[]
  loading: boolean
  error: string | null

  fetchKofrinhos: () => Promise<void>
  createKofrinho: (nome: string, descricao?: string) => Promise<void>
  selectKofrinho: (id: number) => Promise<void>
  updateKofrinho: (id: number, nome?: string, descricao?: string) => Promise<void>
  deleteKofrinho: (id: number) => Promise<void>
  clearSelected: () => void
  createDepositante: (kofrinhoId: number, nome: string, valor: number, recorrencia: string, dataInicio: string, email?: string, telefone?: string) => Promise<void>
  updateDepositante: (kofrinhoId: number, depositanteId: number, data: api.DepositanteUpdate) => Promise<void>
  fetchDepositantes: (kofrinhoId: number) => Promise<void>
  deleteDepositante: (kofrinhoId: number, depositanteId: number) => Promise<void>
  fetchSolicitacoes: (kofrinhoId: number) => Promise<void>
}

const KofrinhoContext = createContext<KofrinhoContextType | undefined>(undefined)

export function KofrinhoProvider({ children }: { children: ReactNode }) {
  const [kofrinhos, setKofrinhos] = useState<Kofrinho[]>([])
  const [selectedKofrinho, setSelectedKofrinho] = useState<Kofrinho | null>(null)
  const [depositantes, setDepositantes] = useState<Depositante[]>([])
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
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
    setDepositantes([])
  }

  const createDepositante = useCallback(async (kofrinhoId: number, nome: string, valor: number, recorrencia: string, dataInicio: string, email?: string, telefone?: string) => {
    setLoading(true)
    try {
      await api.createDepositante(kofrinhoId, nome, valor, recorrencia, dataInicio, email, telefone)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar depositante'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateDepositante = useCallback(async (kofrinhoId: number, depositanteId: number, data: api.DepositanteUpdate) => {
    setLoading(true)
    try {
      const result = await api.updateDepositante(kofrinhoId, depositanteId, data)
      setDepositantes(prev => prev.map(d => d.id === depositanteId ? result.depositante : d))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar depositante'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteDepositante = useCallback(async (kofrinhoId: number, depositanteId: number) => {
    try {
      await api.deleteDepositante(kofrinhoId, depositanteId)
      setDepositantes(prev => prev.filter(d => d.id !== depositanteId))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover depositante'
      setError(message)
      throw err
    }
  }, [])

  const fetchDepositantes = useCallback(async (kofrinhoId: number) => {
    try {
      const data = await api.listDepositantes(kofrinhoId)
      setDepositantes(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar depositantes'
      setError(message)
    }
  }, [])

  const fetchSolicitacoes = useCallback(async (kofrinhoId: number) => {
    try {
      const data = await api.listSolicitacoes(kofrinhoId)
      setSolicitacoes(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar solicitações'
      setError(message)
    }
  }, [])

  const value: KofrinhoContextType = {
    kofrinhos,
    selectedKofrinho,
    depositantes,
    solicitacoes,
    loading,
    error,

    fetchKofrinhos,
    createKofrinho,
    selectKofrinho,
    updateKofrinho,
    deleteKofrinho,
    clearSelected,
    createDepositante,
    updateDepositante,
    fetchDepositantes,
    deleteDepositante,
    fetchSolicitacoes,
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
