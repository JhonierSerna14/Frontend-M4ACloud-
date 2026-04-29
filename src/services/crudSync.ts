import type { QueryClient } from '@tanstack/react-query'
import { authService } from '@/services/auth.service'
import { markTagsDirty } from '@/services/browserCache'
import {
  applySyncCrudEvent,
  type SyncCrudEvent,
} from '@/services/entityCache'

function toWsBase() {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined
  if (apiUrl) {
    return apiUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/api`
}

export function startCrudSyncBridge(queryClient: QueryClient, isDev: boolean) {
  const token = authService.getToken()
  if (!token) {
    return () => {}
  }

  const url = `${toWsBase()}/sync/events?token=${encodeURIComponent(token)}`
  let stop = false
  let socket: WebSocket | null = null
  let reconnectAttempts = 0
  let reconnectTimer: number | null = null
  let lastWarnLogAt = 0

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const logThrottledWarn = (message: string, payload?: unknown) => {
    if (!isDev) return
    const now = Date.now()
    if (now - lastWarnLogAt < 5000) return
    lastWarnLogAt = now
    console.warn(message, payload)
  }

  const scheduleReconnect = () => {
    if (stop || reconnectTimer) return
    const baseDelay = Math.min(30000, 1000 * 2 ** reconnectAttempts)
    const jitter = Math.floor(Math.random() * 500)
    reconnectAttempts += 1
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      connect()
    }, baseDelay + jitter)
  }

  const connect = () => {
    if (stop) return

    try {
      socket = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    socket.onopen = () => {
      clearReconnectTimer()
      reconnectAttempts = 0
      if (isDev) {
        console.debug('[crudSync] ws.onopen')
      }
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { event_type?: string; affected_collections?: string[] }
        if (data.event_type === 'sync.connected') {
          return
        }

        if (data.event_type !== 'sync.event') {
          if (isDev) {
            console.warn('[crudSync] unknown event_type', data)
          }
          return
        }

        const syncEvent = data as SyncCrudEvent
        applySyncCrudEvent(queryClient, syncEvent)

        if (Array.isArray(syncEvent.affected_collections) && syncEvent.affected_collections.length > 0) {
          markTagsDirty(syncEvent.affected_collections)
        }
      } catch {
        if (isDev) {
          console.warn('[crudSync] invalid ws payload')
        }
      }
    }

    socket.onclose = () => {
      if (stop) return
      scheduleReconnect()
    }

    socket.onerror = () => {
      logThrottledWarn('[crudSync] ws.onerror')
      try {
        socket?.close()
      } catch {
        // ignore
      }
    }
  }

  connect()

  return () => {
    stop = true
    clearReconnectTimer()
    try {
      socket?.close()
    } catch {
      // ignore
    }
  }
}
