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

export interface Deposito {
  id: number
  kofrinho_id: number
  nome: string
  valor: number
  recorrencia: 'anual' | 'mensal' | 'semanal' | 'diario'
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
