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

// Data de hoje no formato 'YYYY-MM-DD' (horário local)
export function hojeISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Explica, conforme a recorrência, quando a solicitação (e-mail) será enviada
export function dicaRecorrencia(recorrencia: string, data: string): string {
  const [y, m, d] = data.split('-')
  switch (recorrencia) {
    case 'diario':  return `A solicitação será enviada diariamente a partir de ${d}/${m}/${y}.`
    case 'semanal': return `A solicitação será enviada semanalmente a partir de ${d}/${m}/${y}.`
    case 'mensal':  return `A solicitação será enviada todo mês no dia ${d}, a partir de ${m}/${y}.`
    case 'anual':   return `A solicitação será enviada todo ano em ${d}/${m}.`
    default:        return ''
  }
}

function DepositanteForm({ kofrinhoId, onSuccess }: DepositanteFormProps) {
  const { createDepositante, loading } = useKofrinho()
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [recorrencia, setRecorrencia] = useState('mensal')
  const [dataInicio, setDataInicio] = useState(hojeISO())
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [mensagem, setMensagem] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensagem('')

    const valorNum = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorNum) || valorNum <= 0) {
      setMensagem('Informe um valor válido e positivo')
      return
    }

    if (!dataInicio) {
      setMensagem('Escolha a data de início')
      return
    }

    try {
      await createDepositante(
        kofrinhoId,
        nome.trim(),
        valorNum,
        recorrencia,
        dataInicio,
        email.trim() || undefined,
        telefone.trim() || undefined
      )
      setMensagem('Depositante criado com sucesso!')
      setNome('')
      setValor('')
      setRecorrencia('mensal')
      setDataInicio(hojeISO())
      setEmail('')
      setTelefone('')
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

      <div className="form-group">
        <label htmlFor="depositante-data-inicio">Data de início</label>
        <div className="data-inicio-row">
          <input
            id="depositante-data-inicio"
            type="date"
            min={hojeISO()}
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
          />
          <button
            type="button"
            className="btn-hoje"
            onClick={() => setDataInicio(hojeISO())}
          >
            Hoje
          </button>
        </div>
        <small className="data-inicio-hint">{dicaRecorrencia(recorrencia, dataInicio)}</small>
      </div>

      <div className="form-group">
        <label htmlFor="depositante-email">E-mail</label>
        <input
          id="depositante-email"
          type="email"
          placeholder="contato@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="depositante-telefone">Telefone <span className="optional">(opcional)</span></label>
        <input
          id="depositante-telefone"
          type="tel"
          placeholder="(11) 98765-4321"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />
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
