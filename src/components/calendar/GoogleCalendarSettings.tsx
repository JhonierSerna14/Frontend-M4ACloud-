import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, CheckCircle2, Loader2, RefreshCw, Unlink } from 'lucide-react'
import { googleCalendarService } from '@/services/googleCalendar.service'
import { Button, Badge } from '@/components/ui'
import { useNotification } from '@/context/NotificationContext'
import { useGoogleCalendarOAuthCallback } from '@/hooks/useGoogleCalendarOAuthCallback'

export function GoogleCalendarSettings() {
  const queryClient = useQueryClient()
  const { success, error: notifyError } = useNotification()
  const [isConnecting, setIsConnecting] = useState(false)

  useGoogleCalendarOAuthCallback()

  const { data: status, isLoading } = useQuery({
    queryKey: ['google-calendar', 'status'],
    queryFn: googleCalendarService.getStatus,
  })

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando estado de Google Calendar...
      </div>
    )
  }

  if (!status?.configured) {
    return (
      <p className="text-sm text-muted-foreground">
        La integración con Google Calendar no está disponible en este momento.
      </p>
    )
  }

  if (status.connected) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success" className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Google conectado
          </Badge>
          {status.calendar_name && (
            <span className="text-sm text-muted-foreground">{status.calendar_name}</span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Las tareas con fecha del semestre activo se sincronizan automáticamente con tu calendario de Google.
        </p>

        {status.pending_count && status.pending_count > 0 ? (
          <p className="text-sm text-amber-700">
            Hay {status.pending_count} evento{status.pending_count > 1 ? 's' : ''} pendiente{status.pending_count > 1 ? 's' : ''} de sincronizar.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Re-sincronizar</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="text-muted-foreground"
          >
            <Unlink className="h-4 w-4" />
            <span className="ml-2">Desconectar</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conecta tu cuenta de Google para exportar las tareas del semestre activo a un calendario dedicado en Google Calendar.
      </p>
      <Button
        variant="outline"
        onClick={() => connectMutation.mutate()}
        disabled={connectMutation.isPending || isConnecting}
      >
        {connectMutation.isPending || isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}
        <span className="ml-2">Conectar Google Calendar</span>
      </Button>
    </div>
  )
}
