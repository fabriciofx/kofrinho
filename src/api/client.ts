export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export interface AuthTokens {
  token: string
  refreshToken: string
}

export interface User {
  id: number
  nome_completo: string
  email: string
  foto_avatar?: string | null
  criado_em?: string
}

export interface AuthResponse {
  message: string
  user: User
  token: string
  refreshToken: string
}

export interface Kofrinho {
  id: number
  nome: string
  descricao?: string | null
  user_id: number
  criado_em: string
  saldo: number
}

export interface KofrinhoResponse {
  message: string
  kofrinho?: Kofrinho
  kofrinhos?: Kofrinho[]
}

export interface Solicitacao {
  id: number
  solicitacao_id: string
  kofrinho_id: number
  depositante_id: number
  depositante_nome: string
  valor: number
  pago: number
  pago_em: string | null
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
  data_inicio: string | null
  criado_em: string
}

let storedTokens: AuthTokens | null = null

export function setStoredTokens(tokens: AuthTokens | null) {
  storedTokens = tokens
  if (tokens) {
    localStorage.setItem('authTokens', JSON.stringify(tokens))
  } else {
    localStorage.removeItem('authTokens')
  }
}

export function getStoredTokens(): AuthTokens | null {
  if (!storedTokens) {
    const stored = localStorage.getItem('authTokens')
    if (stored) {
      try {
        storedTokens = JSON.parse(stored)
      } catch (e) {
        localStorage.removeItem('authTokens')
      }
    }
  }
  return storedTokens
}

function getAuthHeaders(): Record<string, string> {
  const tokens = getStoredTokens()
  if (!tokens?.token) {
    return {}
  }
  return {
    'Authorization': `Bearer ${tokens.token}`
  }
}

async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options)
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `Não foi possível conectar ao servidor (${API_BASE_URL}). ` +
        'Verifique se o servidor está em execução e se o endereço está correto.'
      )
    }
    throw err
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    setStoredTokens(null)
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  if (response.status === 403) {
    throw new Error('Acesso negado.')
  }

  if (response.status === 404) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const data = await response.json()
      throw new Error(data.erro || 'Recurso não encontrado.')
    }
    throw new Error('Recurso não encontrado.')
  }

  if (response.status >= 500) {
    throw new Error(`Erro interno do servidor (${response.status}). Tente novamente mais tarde.`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Resposta inesperada do servidor (status ${response.status}). ` +
      'O servidor pode estar retornando HTML em vez de JSON.'
    )
  }

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.erro || `Erro ${response.status}`)
  }

  return data
}

// Auth endpoints
export async function register(
  nome_completo: string,
  email: string,
  senha: string
): Promise<AuthResponse> {
  const response = await apiFetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ nome_completo, email, senha })
  })

  const data = await handleResponse<AuthResponse>(response)
  setStoredTokens({
    token: data.token,
    refreshToken: data.refreshToken
  })
  return data
}

export async function login(email: string, senha: string): Promise<AuthResponse> {
  const response = await apiFetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, senha })
  })

  const data = await handleResponse<AuthResponse>(response)
  setStoredTokens({
    token: data.token,
    refreshToken: data.refreshToken
  })
  return data
}

export async function refreshAccessToken(): Promise<string> {
  const tokens = getStoredTokens()
  if (!tokens?.refreshToken) {
    throw new Error('Sem refresh token')
  }

  const response = await apiFetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken: tokens.refreshToken })
  })

  const data = await handleResponse<{ token: string; refreshToken: string }>(response)
  setStoredTokens({
    token: data.token,
    refreshToken: tokens.refreshToken
  })
  return data.token
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const response = await apiFetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  })

  return handleResponse<{ message: string }>(response)
}

export async function resetPassword(token: string, novaSenha: string): Promise<{ message: string }> {
  const response = await apiFetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token, novaSenha })
  })

  return handleResponse<{ message: string }>(response)
}

// Kofrinho endpoints
export async function createKofrinho(nome: string, descricao?: string): Promise<KofrinhoResponse> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ nome, descricao })
  })

  return handleResponse<KofrinhoResponse>(response)
}

export async function listKofrinhos(): Promise<Kofrinho[]> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })

  const data = await handleResponse<{ kofrinhos: Kofrinho[] }>(response)
  return data.kofrinhos
}

export async function getKofrinho(id: number): Promise<Kofrinho> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })

  const data = await handleResponse<{ kofrinho: Kofrinho }>(response)
  return data.kofrinho
}

export async function updateKofrinho(id: number, nome?: string, descricao?: string): Promise<KofrinhoResponse> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ nome, descricao })
  })

  return handleResponse<KofrinhoResponse>(response)
}

export async function deleteKofrinho(id: number): Promise<{ message: string }> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })

  return handleResponse<{ message: string }>(response)
}

// Depositante endpoints
export async function createDepositante(
  kofrinhoId: number,
  nome: string,
  valor: number,
  recorrencia: string,
  dataInicio: string,
  email?: string,
  telefone?: string
): Promise<{ message: string; depositante: Depositante }> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/depositantes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ nome, valor, recorrencia, data_inicio: dataInicio, email: email || null, telefone: telefone || null })
  })
  return handleResponse(response)
}

export interface DepositanteUpdate {
  nome?: string
  valor?: number
  recorrencia?: string
  data_inicio?: string
  email?: string
  telefone?: string | null
}

export async function updateDepositante(
  kofrinhoId: number,
  depositanteId: number,
  data: DepositanteUpdate
): Promise<{ message: string; depositante: Depositante }> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/depositantes/${depositanteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify(data)
  })
  return handleResponse(response)
}

export async function deleteDepositante(kofrinhoId: number, depositanteId: number): Promise<{ message: string }> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/depositantes/${depositanteId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })
  return handleResponse(response)
}

export async function listDepositantes(kofrinhoId: number): Promise<Depositante[]> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/depositantes`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })
  const data = await handleResponse<{ depositantes: Depositante[] }>(response)
  return data.depositantes
}

export async function listSolicitacoes(kofrinhoId: number): Promise<Solicitacao[]> {
  const response = await apiFetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/solicitacoes`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })
  const data = await handleResponse<{ solicitacoes: Solicitacao[] }>(response)
  return data.solicitacoes
}

// Avatar endpoints
export async function uploadAvatar(file: File): Promise<{ message: string; user: User }> {
  const formData = new FormData()
  formData.append('avatar', file)

  const response = await apiFetch(`${API_BASE_URL}/avatars/upload`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  })

  return handleResponse<{ message: string; user: User }>(response)
}

export async function deleteAvatar(): Promise<{ message: string; user: User }> {
  const response = await apiFetch(`${API_BASE_URL}/avatars`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })

  return handleResponse<{ message: string; user: User }>(response)
}
