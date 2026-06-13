import { useState } from 'react'
import { useKofrinho } from '../context/KofrinhoContext'
import '../styles/DepositoForm.css'

interface DepositoFormProps {
  kofrinhoId: number
  onSuccess?: () => void
}

const RECORRENCIAS = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

function DepositoForm({ kofrinhoId, onSuccess }: DepositoFormProps) {
  const { createDeposito, loading } = useKofrinho()
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
      await createDeposito(kofrinhoId, nome.trim(), valorNum, recorrencia)
      setMensagem('Depósito criado com sucesso!')
      setNome('')
      setValor('')
      setRecorrencia('mensal')
      if (onSuccess) setTimeout(() => onSuccess(), 1200)
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao criar depósito')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="deposito-form">
      <div className="form-group">
        <label htmlFor="deposito-nome">Nome</label>
        <input
          id="deposito-nome"
          type="text"
          placeholder="Ex: Aporte mensal, Bônus, Salário"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="deposito-valor">Valor (R$)</label>
        <input
          id="deposito-valor"
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
        <label htmlFor="deposito-recorrencia">Recorrência</label>
        <select
          id="deposito-recorrencia"
          value={recorrencia}
          onChange={(e) => setRecorrencia(e.target.value)}
        >
          {RECORRENCIAS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Salvando...' : 'Criar Depósito'}
      </button>

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}
    </form>
  )
}

export default DepositoForm
