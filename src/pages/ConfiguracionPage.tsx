import { useAuth } from '@/context/AuthContext'
import { GoogleCalendarSettings } from '@/components/calendar/GoogleCalendarSettings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Calendar, User } from 'lucide-react'

export function ConfiguracionPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Administra tu cuenta e integraciones</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <p className="text-muted-foreground">Nombre</p>
            <p className="font-medium">{user?.nombre}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Correo</p>
            <p className="font-medium">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GoogleCalendarSettings />
        </CardContent>
      </Card>
    </div>
  )
}
