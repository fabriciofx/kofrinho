const API_BASE_URL = 'http://localhost:3000/api'

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
}

export interface KofrinhoResponse {
  message: string
  kofrinho?: Kofrinho
  kofrinhos?: Kofrinho[]
}

export interface Deposito {
  id: number
  kofrinho_id: number
  nome: string
  valor: number
  recorrencia: 'anual' | 'mensal' | 'semanal' | 'diario'
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

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    setStoredTokens(null)
    throw new Error('Token expirado. Faça login novamente.')
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`Erro ${response.status}: resposta inesperada do servidor`)
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
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
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

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
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
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  })

  return handleResponse<{ message: string }>(response)
}

export async function resetPassword(token: string, novaSenha: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
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
  const response = await fetch(`${API_BASE_URL}/kofrinhos`, {
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
  const response = await fetch(`${API_BASE_URL}/kofrinhos`, {
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
  const response = await fetch(`${API_BASE_URL}/kofrinhos/${id}`, {
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
  const response = await fetch(`${API_BASE_URL}/kofrinhos/${id}`, {
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
  const response = await fetch(`${API_BASE_URL}/kofrinhos/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })

  return handleResponse<{ message: string }>(response)
}

// Deposito endpoints
export async function createDeposito(
  kofrinhoId: number,
  nome: string,
  valor: number,
  recorrencia: string
): Promise<{ message: string; deposito: Deposito }> {
  const response = await fetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/depositos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({ nome, valor, recorrencia })
  })
  return handleResponse(response)
}

export async function deleteDeposito(kofrinhoId: number, depositoId: number): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/depositos/${depositoId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })
  return handleResponse(response)
}

export async function listDepositos(kofrinhoId: number): Promise<Deposito[]> {
  const response = await fetch(`${API_BASE_URL}/kofrinhos/${kofrinhoId}/depositos`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })
  const data = await handleResponse<{ depositos: Deposito[] }>(response)
  return data.depositos
}

// Avatar endpoints
export async function uploadAvatar(file: File): Promise<{ message: string; user: User }> {
  const formData = new FormData()
  formData.append('avatar', file)

  const response = await fetch(`${API_BASE_URL}/avatars/upload`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  })

  return handleResponse<{ message: string; user: User }>(response)
}

export async function deleteAvatar(): Promise<{ message: string; user: User }> {
  const response = await fetch(`${API_BASE_URL}/avatars`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    }
  })

  return handleResponse<{ message: string; user: User }>(response)
}
