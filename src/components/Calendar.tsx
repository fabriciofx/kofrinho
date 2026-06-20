import { useState } from 'react'
import '../styles/Calendar.css'

interface CalendarProps {
  value: string                 // data selecionada no formato 'YYYY-MM-DD'
  onChange: (iso: string) => void
  min?: string                  // datas anteriores a esta ficam desabilitadas ('YYYY-MM-DD')
  id?: string
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function hojeISO(): string {
  const d = new Date()
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

function Calendar({ value, onChange, min, id }: CalendarProps) {
  const sel = parseISO(value || hojeISO())
  const [view, setView] = useState<{ y: number; m: number }>({ y: sel.y, m: sel.m })

  const hoje = hojeISO()
  const primeiroDiaSemana = new Date(view.y, view.m - 1, 1).getDay() // 0 (Dom) – 6 (Sáb)
  const diasNoMes = new Date(view.y, view.m, 0).getDate()

  const prevMonth = () => setView(v => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () => setView(v => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }))

  // Comparação lexicográfica funciona para datas no formato ISO 'YYYY-MM-DD'
  const desabilitada = (iso: string) => (min ? iso < min : false)

  const selecionar = (d: number) => {
    const iso = toISO(view.y, view.m, d)
    if (!desabilitada(iso)) onChange(iso)
  }

  const irHoje = () => {
    const h = parseISO(hoje)
    setView({ y: h.y, m: h.m })
    if (!desabilitada(hoje)) onChange(hoje)
  }

  const celulas: (number | null)[] = []
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null)
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d)

  const formatado = `${String(sel.d).padStart(2, '0')}/${String(sel.m).padStart(2, '0')}/${sel.y}`

  return (
    <div className="calendar" id={id} data-value={value}>
      <div className="calendar-header">
        <button type="button" className="calendar-nav" onClick={prevMonth} aria-label="Mês anterior">‹</button>
        <span className="calendar-title">{MESES[view.m - 1]} {view.y}</span>
        <button type="button" className="calendar-nav" onClick={nextMonth} aria-label="Próximo mês">›</button>
      </div>

      <div className="calendar-weekdays">
        {DIAS.map(d => <span key={d} className="calendar-weekday">{d}</span>)}
      </div>

      <div className="calendar-grid">
        {celulas.map((d, i) => {
          if (d === null) return <span key={`vazio-${i}`} className="calendar-cell calendar-empty" />
          const iso = toISO(view.y, view.m, d)
          const classes = [
            'calendar-cell',
            'calendar-day',
            iso === value ? 'selected' : '',
            iso === hoje ? 'today' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              type="button"
              key={iso}
              className={classes}
              disabled={desabilitada(iso)}
              aria-pressed={iso === value}
              onClick={() => selecionar(d)}
            >
              {d}
            </button>
          )
        })}
      </div>

      <div className="calendar-footer">
        <span className="calendar-selected">Selecionado: {formatado}</span>
        <button type="button" className="calendar-hoje" onClick={irHoje}>Hoje</button>
      </div>
    </div>
  )
}

export default Calendar
