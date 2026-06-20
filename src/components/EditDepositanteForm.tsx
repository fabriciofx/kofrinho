import { useState } from 'react'
import { useKofrinho, type Depositante } from '../context/KofrinhoContext'
import { hojeISO, dicaRecorrencia } from './DepositanteForm'
import Calendar from './Calendar'
import '../styles/DepositanteForm.css'

const RECORRENCIAS = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

interface EditDepositanteFormProps {
  kofrinhoId: number
  depositante: Depositante
  onSuccess?: () => void
}

function EditDepositanteForm({ kofrinhoId, depositante, onSuccess }: EditDepositanteFormProps) {
  const { updateDepositante, loading } = useKofrinho()
  const [nome, setNome] = useState(depositante.nome)
  const [valor, setValor] = useState(String(depositante.valor))
  const [recorrencia, setRecorrencia] = useState(depositante.recorrencia)
  const [dataInicio, setDataInicio] = useState(depositante.data_inicio ?? hojeISO())
  const [email, setEmail] = useState(depositante.email ?? '')
  const [telefone, setTelefone] = useState(depositante.telefone ?? '')
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
      await updateDepositante(kofrinhoId, depositante.id, {
        nome: nome.trim(),
        valor: valorNum,
        recorrencia,
        data_inicio: dataInicio,
        email: email.trim(),
        telefone: telefone.trim() || null,
      })
      setMensagem('Depositante atualizado com sucesso!')
      if (onSuccess) setTimeout(() => onSuccess(), 1200)
    } catch (err) {
      setMensagem(err instanceof Error ? err.message : 'Erro ao atualizar depositante')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="depositante-form">
      <div className="form-group">
        <label htmlFor="edit-depositante-nome">Nome</label>
        <input
          id="edit-depositante-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="edit-depositante-valor">Valor (R$)</label>
        <input
          id="edit-depositante-valor"
          type="number"
          min="0.01"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="edit-depositante-recorrencia">Recorrência</label>
        <select
          id="edit-depositante-recorrencia"
          value={recorrencia}
          onChange={(e) => setRecorrencia(e.target.value as Depositante['recorrencia'])}
        >
          {RECORRENCIAS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Data de início</label>
        <Calendar
          id="edit-depositante-data-inicio"
          value={dataInicio}
          onChange={setDataInicio}
        />
        <small className="data-inicio-hint">{dicaRecorrencia(recorrencia, dataInicio)}</small>
      </div>

      <div className="form-group">
        <label htmlFor="edit-depositante-email">E-mail</label>
        <input
          id="edit-depositante-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="edit-depositante-telefone">Telefone <span className="optional">(opcional)</span></label>
        <input
          id="edit-depositante-telefone"
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar Alterações'}
      </button>

      {mensagem && (
        <div className={`mensagem ${mensagem.includes('sucesso') ? 'sucesso' : 'erro'}`}>
          {mensagem}
        </div>
      )}
    </form>
  )
}

export default EditDepositanteForm
