import { useEffect, useRef, useState, useCallback } from 'react'
import { authService } from '@/services/auth.service'
import { notasService } from '@/services/notas.service'

type ProgressState = {
  status: string | null
  progress: number
  message?: string | null
  connected: boolean
}

/**
 * Hook que escucha el progreso de procesamiento de una nota vía WebSocket.
 * NO hace polling al backend — todo el progreso llega por WS en tiempo real.
 * Solo hace un fetch HTTP inicial para arrancar la UI con el estado actual.
 */
export function useNotaProgress(notaId?: number | null) {
  const isDev = import.meta.env.DEV
  const [state, setState] = useState<ProgressState>({ status: null, progress: 0, message: null, connected: false })
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<number>(0)
  const reconnectTimerRef = useRef<number | null>(null)
  const stopRef = useRef<boolean>(false)
  const initialFetchDone = useRef<boolean>(false)
  const pingRef = useRef<number | null>(null)
  const lastErrorLogRef = useRef<number>(0)

  // Fetch HTTP para inicializar/refrescar el estado visual
  const fetchStatus = useCallback(async () => {
    if (!notaId) return
    try {
      const res = await notasService.getStatus(notaId)
      setState(prev => ({
        ...prev,
        status: res.status,
        progress: res.progress,
        message: res.message ?? prev.message,
      }))
    } catch {
      // ignore — WS actualizará el estado
    }
  }, [notaId])

  // Fetch inicial único (solo al montar)
  const fetchInitialStatus = useCallback(async () => {
    if (!notaId || initialFetchDone.current) return
    initialFetchDone.current = true
    await fetchStatus()
  }, [notaId, fetchStatus])

  // Refetch público para forzar re-lectura (e.g. después de reprocesar)
  const refetch = useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!notaId) return
    stopRef.current = false
    initialFetchDone.current = false

    // Fetch inicial único para que la UI no arranque en 0%
    fetchInitialStatus()

    const token = authService.getToken()
    if (!token) return // Sin token no se puede autenticar el WS

    // Derivar host/protocol del VITE_API_URL si está definido (deploy en cloud)
    // En local usa window.location para que el proxy de Vite funcione
    let apiUrl = import.meta.env.VITE_API_URL as string | undefined
    let wsBase: string
    if (apiUrl) {
      if (apiUrl.endsWith('/api')) {
        apiUrl += '/v1'
      }
      // Convertir https://... → wss://... y http://... → ws://...
      wsBase = apiUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
    } else {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      wsBase = `${proto}://${window.location.host}/api`
    }
    const url = `${wsBase}/notas/${notaId}/progress?token=${encodeURIComponent(token)}`

    let cleanupFn: (() => void) | undefined

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (stopRef.current || reconnectTimerRef.current) return
      const baseDelay = Math.min(30000, 1000 * 2 ** reconnectRef.current)
      const jitter = Math.floor(Math.random() * 500)
      const delay = baseDelay + jitter
      reconnectRef.current += 1
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        if (!stopRef.current) connect()
      }, delay)
    }

    const logThrottledWsError = (label: string, payload?: unknown) => {
      if (!isDev) return
      const now = Date.now()
      if (now - lastErrorLogRef.current < 5000) return
      lastErrorLogRef.current = now
      console.warn(label, payload)
    }

    function connect() {
      try {
        wsRef.current = new WebSocket(url)
      } catch {
        scheduleReconnect()
        return
      }

      const ws = wsRef.current!

      ws.onopen = () => {
        if (isDev) {
          console.debug('[useNotaProgress] ws.onopen', { notaId, url })
        }
        clearReconnectTimer()
        reconnectRef.current = 0
        setState(prev => ({ ...prev, connected: true }))
        // Refrescar estado desde servidor al reconectar para sincronizar
        fetchStatus().catch(() => {})

        // Keep-alive: enviar ping cada 20s para asegurar que proxies/servidor mantengan la conexión
        try {
          if (pingRef.current) {
            clearInterval(pingRef.current)
          }
          pingRef.current = window.setInterval(() => {
            try { ws.send('ping') } catch { /* ignore */ }
          }, 20000)
        } catch { /* ignore */ }
      }

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (isDev) {
            console.debug('[useNotaProgress] ws.onmessage', { notaId, data })
          }
          setState(prev => ({
            ...prev,
            status: data.status,
            progress: data.progress,
            message: data.message || prev.message,
          }))
        } catch { /* ignore */ }
      }

      ws.onclose = (ev) => {
        if (isDev) {
          console.warn('[useNotaProgress] ws.onclose', { notaId, code: ev.code, reason: ev.reason })
        }
        setState(prev => ({ ...prev, connected: false }))
        // limpiar ping
        if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
        if (stopRef.current) return
        // Reconexión con backoff exponencial + jitter para evitar reconexiones simultáneas
        scheduleReconnect()
      }

      ws.onerror = (ev) => {
        logThrottledWsError('[useNotaProgress] ws.onerror', { notaId, ev })
        try { ws.close() } catch { /* ignore */ }
      }

      cleanupFn = () => {
        clearReconnectTimer()
        try { ws.close() } catch { /* ignore */ }
        if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null }
      }
    }

    connect()

    return () => {
      stopRef.current = true
      if (cleanupFn) cleanupFn()
    }
  }, [notaId, fetchInitialStatus, isDev])

  return { ...state, refetch }
}
