import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, CheckCircle2, Loader2, RefreshCw, Unlink } from 'lucide-react'
import { googleCalendarService } from '@/services/googleCalendar.service'
import { Button, Badge } from '@/components/ui'
import { useNotification } from '@/context/NotificationContext'

export function GoogleCalendarConnect() {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotification()
  const [isConnecting, setIsConnecting] = useState(false)

  const { data: status, isLoading } = useQuery({
    queryKey: ['google-calendar', 'status'],
    queryFn: googleCalendarService.getStatus,
  })

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

  const connectMutation = useMutation({
    mutationFn: googleCalendarService.getAuthUrl,
    onMutate: () => setIsConnecting(true),
    onSuccess: (authUrl) => {
      window.location.href = authUrl
    },
    onError: () => {
      setIsConnecting(false)
      notifyError('Google Calendar', 'No se pudo iniciar la conexión con Google')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: googleCalendarService.disconnect,
    onSuccess: () => {
      success('Google Calendar', 'Calendario desconectado')
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'status'] })
    },
    onError: () => notifyError('Google Calendar', 'No se pudo desconectar'),
  })

  const syncMutation = useMutation({
    mutationFn: googleCalendarService.syncNow,
    onSuccess: (result) => {
      success(
        'Google Calendar',
        `Sincronización completada (${result.synced} eventos, ${result.errors} errores)`
      )
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'status'] })
    },
    onError: () => notifyError('Google Calendar', 'No se pudo sincronizar'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Google Calendar...
      </div>
    )
  }

  if (!status?.configured) {
    return null
  }

  if (status.connected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="success" className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Google conectado
        </Badge>
        {status.calendar_name && (
          <span className="text-xs text-muted-foreground hidden sm:inline">{status.calendar_name}</span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="h-7 text-xs"
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="ml-1">Re-sincronizar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
          className="h-7 text-xs text-muted-foreground"
        >
          <Unlink className="h-3.5 w-3.5" />
          <span className="ml-1">Desconectar</span>
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => connectMutation.mutate()}
      disabled={connectMutation.isPending || isConnecting}
      className="h-8 text-xs"
    >
      {connectMutation.isPending || isConnecting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Calendar className="h-3.5 w-3.5" />
      )}
      <span className="ml-1.5">Conectar Google Calendar</span>
    </Button>
  )
}
