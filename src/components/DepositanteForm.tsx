import { useState } from 'react'
import { useKofrinho } from '../context/KofrinhoContext'
import '../styles/DepositanteForm.css'

interface DepositanteFormProps {
  kofrinhoId: number
  onSuccess?: () => void
}

const RECORRENCIAS = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

function DepositanteForm({ kofrinhoId, onSuccess }: DepositanteFormProps) {
  const { createDepositante, loading } = useKofrinho()
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [recorrencia, setRecorrencia] = useState('mensal')
  const [mensagem, setMensagem] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensagem('')

    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      setMensagem('Informe um valor válido e positivo')
      return
    }

    try {
      await createDepositante(kofrinhoId, nome.trim(), valorNum, recorrencia)
      setMensagem('Depositante criado com sucesso!')
      setNome('')
      setValor('')
      setRecorrencia('mensal')
      if (onSuccess) setTimeout(() => onSuccess(), 1200)
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao criar depositante')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="depositante-form">
      <div className="form-group">
        <label htmlFor="depositante-nome">Nome</label>
        <input
          id="depositante-nome"
          type="text"
          placeholder="Ex: Aporte mensal, Bônus, Salário"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="depositante-valor">Valor (R$)</label>
        <input
          id="depositante-valor"
          type="number"
          placeholder="0,00"
          min="0.01"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="depositante-recorrencia">Recorrência</label>
        <select
          id="depositante-recorrencia"
          value={recorrencia}
          onChange={(e) => setRecorrencia(e.target.value)}
        >
          {RECORRENCIAS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Salvando...' : 'Criar Depositante'}
      </button>

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}
    </form>
  )
}

export default DepositanteForm
