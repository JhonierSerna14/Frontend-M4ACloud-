import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/auth.service'
import type { Usuario, LoginCredentials, RegisterData } from '@/types'

interface AuthContextType {
  user: Usuario | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authService.getCurrentUser()
      setUser(userData)
    } catch {
      authService.logout()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const initAuth = async () => {
      const token = authService.getToken()
      if (token) {
        try {
          const userData = await authService.getCurrentUser()
          setUser(userData)
        } catch {
          // El interceptor de API gestiona refresh/retry. Si falla, cerrar sesión local.
          authService.logout()
          setUser(null)
        }
      }
      setIsLoading(false)
    }
    
    initAuth()
  }, [])

  const login = async (credentials: LoginCredentials) => {
    await authService.login(credentials)
    const userData = await authService.getCurrentUser()
    setUser(userData)
    // Invalidate all queries when user logs in
    queryClient.clear()
  }

  const register = async (data: RegisterData) => {
    await authService.register(data)
    await login({ email: data.email, password: data.password })
  }

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
    // Clear all cached data when user logs out
    queryClient.clear()
  }, [queryClient])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}
