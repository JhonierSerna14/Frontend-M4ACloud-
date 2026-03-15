import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'

type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string | null
  progress?: number
  persistent?: boolean
  url?: string
}

interface NotificationContextType {
  notifications: Notification[]
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
  loading: (title: string, message?: string, url?: string) => string
  update: (id: string, updates: Partial<Omit<Notification, 'id'>>) => void
  dismiss: (id: string) => void
  dismissAll: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
}

const colors = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  loading: 'bg-indigo-50 border-indigo-200 text-indigo-800',
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((
    type: NotificationType, 
    title: string, 
    message?: string | null,
    persistent?: boolean,
    url?: string
  ): string => {
    const id = Math.random().toString(36).substring(2, 11)
    setNotifications(prev => [...prev, { id, type, title, message: message ?? null, persistent, url }])
    
    // Auto-dismiss después de 5 segundos, excepto si es persistente o loading
    if (!persistent && type !== 'loading') {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }, 5000)
    }
    
    return id
  }, [])

  const update = useCallback((id: string, updates: Partial<Omit<Notification, 'id'>>) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, ...updates } : n)
    )
    
    // Si se actualiza a un tipo que no es loading, auto-dismiss salvo que sea persistente
    if (updates.type && updates.type !== 'loading' && !updates.persistent) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }, 5000)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setNotifications([])
  }, [])

  const success = useCallback((title: string, message?: string) => 
    addNotification('success', title, message), [addNotification])
  const error = useCallback((title: string, message?: string) => 
    addNotification('error', title, message), [addNotification])
  const warning = useCallback((title: string, message?: string) => 
    addNotification('warning', title, message), [addNotification])
  const info = useCallback((title: string, message?: string) => 
    addNotification('info', title, message), [addNotification])
  const loading = useCallback((title: string, message?: string, url?: string) => 
    addNotification('loading', title, message, true, url), [addNotification])

  return (
    <NotificationContext.Provider value={{ 
      notifications, success, error, warning, info, loading, update, dismiss, dismissAll 
    }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {notifications.map(notification => {
          const Icon = icons[notification.type]
          const isLoading = notification.type === 'loading'
          const hasUrl = Boolean(notification.url)
          return (
            <div
              key={notification.id}
              onClick={() => {
                if (notification.url) {
                  window.location.href = notification.url
                }
              }}
              className={'border rounded-lg p-4 shadow-lg flex gap-3 items-start animate-in slide-in-from-right ' + colors[notification.type]}
              style={{ cursor: hasUrl ? 'pointer' : 'default' }}
            >
              <Icon className={'h-5 w-5 shrink-0 mt-0.5' + (isLoading ? ' animate-spin' : '')} />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{notification.title}</p>
                {notification.message && (
                  <p className="text-sm opacity-80 mt-1">{notification.message}</p>
                )}
                {notification.progress !== undefined && (
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${notification.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {!isLoading && (
                <button onClick={(e) => { e.stopPropagation(); dismiss(notification.id) }} className="shrink-0 hover:opacity-70">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </NotificationContext.Provider>
  )
}
