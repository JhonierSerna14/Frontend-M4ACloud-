import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNotification } from '@/context/NotificationContext'

export function useGoogleCalendarOAuthCallback() {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotification()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gcal = params.get('gcal')
    if (!gcal) return

    if (gcal === 'connected') {
      success('Google Calendar', 'Calendario conectado y sincronizado correctamente')
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'status'] })
    } else if (gcal === 'error') {
      const message = params.get('gcal_message') || 'No se pudo conectar con Google Calendar'
      notifyError('Google Calendar', message)
    }

    params.delete('gcal')
    params.delete('gcal_message')
    const nextSearch = params.toString()
    const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname
    window.history.replaceState({}, '', nextUrl)
  }, [notifyError, queryClient, success])
}
