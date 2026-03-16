import { useEffect, useRef } from 'react'
import { useNotaProgress } from '@/hooks/useNotaProgress'
import { useNotification } from '@/context/NotificationContext'
import { markTagsDirty } from '@/services/browserCache'

interface Props {
  notaId: number
  notifId: string
  onFinish?: (notaId: number) => void
}

export default function ProcessingToast({ notaId, notifId, onFinish }: Props) {
  const { status, progress, message: wsMessage } = useNotaProgress(notaId)
  const { update, dismiss } = useNotification()
  const lastUpdateRef = useRef(0)
  const lastProgressRef = useRef<number | null>(null)
  const hasReceivedData = useRef(false)

  useEffect(() => {
    // Skip only the very first update if it's the default state (to avoid overriding the notification setup)
    // Once we've received any data, don't skip anymore
    if (!hasReceivedData.current && status === null && progress === 0) return
    
    // Mark that we've started receiving updates
    if (status !== null || progress > 0) {
      hasReceivedData.current = true
    }

    // When finished or error, convert notification accordingly (always immediate)
    if (status === 'done') {
      markTagsDirty(['notas', 'dashboard', `nota:${notaId}`])
      update(notifId, { type: 'success', title: 'Resumen listo', message: 'Haz clic para abrir la nota', progress: 100, persistent: false, url: `/notas/${notaId}` })
      setTimeout(() => {
        try { dismiss(notifId) } catch (_) {}
      }, 8000)
      if (onFinish) onFinish(notaId)
      return
    }

    if (status === 'error') {
      update(notifId, { type: 'error', title: 'Error', message: 'Falló el procesamiento', persistent: false })
      if (onFinish) onFinish(notaId)
      return
    }

    // Throttle progress updates: either 1.5s elapsed OR >=2% change
    const now = Date.now()
    const elapsed = now - lastUpdateRef.current
    const progDiff = lastProgressRef.current === null
      ? true
      : Math.abs((progress || 0) - (lastProgressRef.current || 0)) >= 2

    if (elapsed > 1500 || progDiff) {
      const displayMsg = wsMessage
        ? `${progress}% — ${wsMessage}`
        : `${progress}%`
      update(notifId, { progress, message: displayMsg })
      lastUpdateRef.current = now
      lastProgressRef.current = progress
    }

  }, [progress, status, wsMessage, notifId, update, dismiss, notaId, onFinish])

  return null
}
