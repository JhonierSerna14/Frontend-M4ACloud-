import api from './api'
import { cachedGet, clearCurrentUserCache, markTagsDirty } from './browserCache'
import type { Usuario, LoginCredentials, RegisterData, TokenResponse } from '@/types'

const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export const authService = {
  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    const formData = new FormData()
    formData.append('username', credentials.email)
    formData.append('password', credentials.password)
    
    const response = await api.post<TokenResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    // Guardar ambos tokens
    localStorage.setItem(TOKEN_KEY, response.data.access_token)
    if (response.data.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh_token)
    }

    markTagsDirty(['auth:user'])
    
    return response.data
  },

  register: async (data: RegisterData): Promise<Usuario> => {
    const response = await api.post<Usuario>('/auth/register', data)
    return response.data
  },

  getCurrentUser: async (): Promise<Usuario> => {
    return cachedGet('auth:me', async () => {
      const response = await api.get<Usuario>('/auth/me')
      return response.data
    }, {
      ttlMs: 1000 * 60 * 10,
      staleWhileRevalidateMs: 1000 * 60 * 10,
      tags: ['auth:user']
    })
  },

  logout: () => {
    clearCurrentUserCache()
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },

  getToken: () => localStorage.getItem(TOKEN_KEY),
  
  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY)
}
