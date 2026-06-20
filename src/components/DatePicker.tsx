import { useState, useEffect, useRef } from 'react'
import Calendar from './Calendar'
import '../styles/DatePicker.css'

interface DatePickerProps {
  value: string                 // data no formato ISO 'YYYY-MM-DD'
  onChange: (iso: string) => void
  min?: string                  // datas anteriores ficam desabilitadas no calendário
  id?: string
}

// ISO 'YYYY-MM-DD' → texto 'DD/MM/AAAA'
function isoParaBR(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// texto 'DD/MM/AAAA' → ISO 'YYYY-MM-DD' (ou null se inválido)
function brParaISO(br: string): string | null {
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  if (dt.getFullYear() !== Number(y) || dt.getMonth() !== Number(mo) - 1 || dt.getDate() !== Number(d)) {
    return null
  }
  return `${y}-${mo}-${d}`
}

function DatePicker({ value, onChange, min, id }: DatePickerProps) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState(isoParaBR(value))
  const wrapperRef = useRef<HTMLDivElement>(null)

  // mantém o texto em sincronia quando o valor muda por fora (ex.: botão "Hoje", edição)
  useEffect(() => { setTexto(isoParaBR(value)) }, [value])

  // fecha o calendário ao clicar fora do componente
  useEffect(() => {
    if (!aberto) return
    function onDocMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [aberto])

  function handleTextoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const t = e.target.value
    setTexto(t)
    const iso = brParaISO(t)
    if (iso && (!min || iso >= min)) onChange(iso)
  }

  // ao sair do campo, descarta texto inválido voltando ao valor atual
  function handleBlur() {
    setTexto(isoParaBR(value))
  }

  function handleEscolher(iso: string) {
    onChange(iso)
    setTexto(isoParaBR(iso))
    setAberto(false)
  }

  return (
    <div className="datepicker" ref={wrapperRef} id={id} data-value={value}>
      <div className="datepicker-field">
        <input
          type="text"
          className="datepicker-input"
          placeholder="DD/MM/AAAA"
          inputMode="numeric"
          value={texto}
          onChange={handleTextoChange}
          onBlur={handleBlur}
        />
        <button
          type="button"
          className="datepicker-toggle"
          aria-label="Abrir calendário"
          aria-expanded={aberto}
          onClick={() => setAberto(a => !a)}
        >
          📅
        </button>
      </div>

      {aberto && (
        <div className="datepicker-popup">
          <Calendar value={value} onChange={handleEscolher} min={min} />
        </div>
      )}
    </div>
  )
}

export default DatePicker
