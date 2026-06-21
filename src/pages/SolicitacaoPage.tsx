import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSolicitacao, type SolicitacaoPublica } from '../api/client'
import '../styles/Solicitacao.css'

// Normaliza o QR code para um data URL utilizável em <img>. A API pode devolver
// tanto um data URL completo (data:image/png;base64,...) quanto base64 puro.
function normalizarQrCode(pixUrl: string): string {
  return pixUrl.startsWith('data:') ? pixUrl : `data:image/png;base64,${pixUrl}`
}

function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function SolicitacaoPage() {
  const { solicitacaoId } = useParams<{ solicitacaoId: string }>()
  const [solicitacao, setSolicitacao] = useState<SolicitacaoPublica | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let ativo = true
    if (!solicitacaoId) {
      setError('Solicitação não encontrada.')
      setLoading(false)
      return
    }

    getSolicitacao(solicitacaoId)
      .then((dados) => {
        if (ativo) setSolicitacao(dados)
      })
      .catch((err: Error) => {
        if (ativo) setError(err.message || 'Não foi possível carregar a solicitação.')
      })
      .finally(() => {
        if (ativo) setLoading(false)
      })

    return () => {
      ativo = false
    }
  }, [solicitacaoId])

  async function copiarPix() {
    if (!solicitacao?.pix_code) return
    try {
      await navigator.clipboard.writeText(solicitacao.pix_code)
    } catch {
      // Fallback para navegadores/contextos sem a Clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = solicitacao.pix_code
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  if (loading) {
    return (
      <div className="solicitacao-page">
        <div className="solicitacao-card">
          <p className="solicitacao-status">Carregando solicitação…</p>
        </div>
      </div>
    )
  }

  if (error || !solicitacao) {
    return (
      <div className="solicitacao-page">
        <div className="solicitacao-card">
          <h1 className="solicitacao-titulo">Kofrinho 🐷</h1>
          <p className="solicitacao-erro">{error ?? 'Solicitação não encontrada.'}</p>
        </div>
      </div>
    )
  }

  const referencia = solicitacao.kofrinho_descricao || solicitacao.kofrinho_nome
  const valorFormatado = formatarValor(solicitacao.valor)

  return (
    <div className="solicitacao-page">
      <div className="solicitacao-card">
        <h1 className="solicitacao-titulo">Olá! Eu sou o Kofrinho! 🐷</h1>

        <p className="solicitacao-mensagem">
          Estou lhe enviando essa mensagem para lembrar-lhe de depositar{' '}
          <strong>{valorFormatado}</strong> no Kofrinho de{' '}
          <strong>{solicitacao.dono_nome}</strong> referente a <strong>{referencia}</strong>.
        </p>

        {solicitacao.pago === 1 ? (
          <p className="solicitacao-pago" data-testid="solicitacao-pago">
            ✅ Este depósito já foi confirmado. Obrigado!
          </p>
        ) : (
          <>
            <h2 className="solicitacao-subtitulo">Pagamento via Pix</h2>
            <p className="solicitacao-instrucao">
              Escaneie o QR Code abaixo ou use o código Pix para realizar o depósito:
            </p>

            {solicitacao.pix_url && (
              <img
                className="solicitacao-qrcode"
                src={normalizarQrCode(solicitacao.pix_url)}
                alt="QR Code Pix"
                width={220}
                height={220}
              />
            )}

            {solicitacao.pix_code && (
              <>
                <p className="solicitacao-instrucao">
                  <strong>Código Pix (Copia e Cola):</strong>
                </p>
                <pre className="solicitacao-pix-code" data-testid="pix-code">
                  {solicitacao.pix_code}
                </pre>
                <button
                  type="button"
                  className="solicitacao-copiar"
                  onClick={copiarPix}
                  data-testid="copiar-pix"
                >
                  {copiado ? 'Copiado!' : 'Copiar código Pix'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
