import { createContext, useContext, useState, type ReactNode } from 'react'
import Kofrinho from '../models/Kofrinho'

interface KofrinhoContextType {
  kofrinho: Kofrinho | null
  setKofrinho: (kofrinho: Kofrinho | null) => void
  adicionarValor: (valor: number) => void
  resgatarValor: () => number
}

const KofrinhoContext = createContext<KofrinhoContextType | undefined>(undefined)

export function KofrinhoProvider({ children }: { children: ReactNode }) {
  const [kofrinho, setKofrinho] = useState<Kofrinho | null>(null)

  const adicionarValor = (valor: number) => {
    if (kofrinho) {
      setKofrinho(kofrinho.adicionarValor(valor))
    }
  }

  const resgatarValor = () => {
    if (kofrinho) {
      const { saldo, novoKofrinho } = kofrinho.resgatarValor()
      setKofrinho(novoKofrinho)
      return saldo
    }
    return 0
  }

  return (
    <KofrinhoContext.Provider value={{ kofrinho, setKofrinho, adicionarValor, resgatarValor }}>
      {children}
    </KofrinhoContext.Provider>
  )
}

export function useKofrinho() {
  const context = useContext(KofrinhoContext)
  if (!context) {
    throw new Error('useKofrinho deve ser usado dentro de KofrinhoProvider')
  }
  return context
}
