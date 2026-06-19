export interface User {
  id: number
  nome_completo: string
  email: string
  senha_hash?: string
  foto_avatar?: string | null
  reset_token?: string | null
  reset_token_expira_em?: string | null
  criado_em: string
  atualizado_em: string
}

export interface Kofrinho {
  id: number
  nome: string
  descricao?: string | null
  user_id: number
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
  criado_em: string
}

export interface Solicitacao {
  id: number
  pagamento_id: string
  kofrinho_id: number
  depositante_id: number
  depositante_nome: string
  valor: number
  pago: number
  pago_em: string | null
  criado_em: string
}

export interface Agendamento {
  id: number
  depositante_id: number
  kofrinho_id: number
  user_id: number
  recorrencia: 'anual' | 'mensal' | 'semanal' | 'diario'
  proxima_execucao: string
  ultima_execucao: string | null
  ativo: number
  criado_em: string
}

export interface JwtPayload {
  id: number
  email: string
  iat: number
  exp: number
}

export interface AuthResponse {
  user: Omit<User, 'senha_hash' | 'reset_token' | 'reset_token_expira_em'>
  token: string
  refreshToken: string
}
