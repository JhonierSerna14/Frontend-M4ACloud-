import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { addMonths, getDay, getDaysInMonth, startOfMonth, subMonths, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { dashboardService } from '@/services/dashboard.service'
import { tareasService } from '@/services/tareas.service'
import { Card, CardContent, CardHeader, CardTitle, Loading, Badge } from '@/components/ui'
import { BookOpen, FileText, CheckSquare, Mic, Plus, Calendar, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

const WEEKDAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

export function DashboardPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardService.getDashboard
  })

  const { data: calendario } = useQuery({
    queryKey: ['tareas', 'calendario', currentMonth.getMonth() + 1, currentMonth.getFullYear()],
    queryFn: () => tareasService.getCalendario(currentMonth.getMonth() + 1, currentMonth.getFullYear())
  })

  const eventosPorDia = calendario?.eventos || {}
  const firstDayOfMonth = startOfMonth(currentMonth)
  const daysInMonth = getDaysInMonth(currentMonth)
  const firstWeekdayOffset = (getDay(firstDayOfMonth) + 6) % 7
  const totalCells = Math.ceil((firstWeekdayOffset + daysInMonth) / 7) * 7
  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: es })
  const selectedDayEvents = selectedDay ? (eventosPorDia[String(selectedDay)] || []) : []

  const overdueCount = useMemo(() => {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    let count = 0

    Object.entries(eventosPorDia).forEach(([day, events]) => {
      const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), Number(day))
      if (dayDate < todayStart) {
        count += events.filter((event) => event.estado !== 'completada').length
      }
    })

    return count
  }, [eventosPorDia, currentMonth])

  useEffect(() => {
    if (!calendario) return

    const today = new Date()
    const isCurrentMonth =
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth()

    if (isCurrentMonth) {
      setSelectedDay(today.getDate())
      return
    }

    const firstDayWithEvents = Object.keys(eventosPorDia)
      .map(Number)
      .sort((a, b) => a - b)[0]

    setSelectedDay(firstDayWithEvents || 1)
  }, [calendario, currentMonth, eventosPorDia])

  const stats = [
    { label: 'Materias', value: dashboard?.total_materias || 0, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Notas', value: dashboard?.total_notas || 0, icon: FileText, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Tareas Pendientes', value: dashboard?.tareas_pendientes || 0, icon: CheckSquare, color: 'text-orange-600', bg: 'bg-orange-100' },
  ]

  if (isLoading) return <Loading size="lg" className="mt-12" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Bienvenido de vuelta</p>
        </div>
        <Link to="/grabar" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          <Mic className="h-4 w-4" />
          Grabar clase
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendario
            </span>
            {overdueCount > 0 && (
              <Badge variant="destructive" className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold capitalize">{monthLabel}</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="h-8 w-8 rounded-md border hover:bg-muted inline-flex items-center justify-center"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="h-8 w-8 rounded-md border hover:bg-muted inline-flex items-center justify-center"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1 font-medium">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: totalCells }, (_, index) => {
              const dayNumber = index - firstWeekdayOffset + 1
              const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth
              const dayEvents = inMonth ? (eventosPorDia[String(dayNumber)] || []) : []
              const isSelected = selectedDay === dayNumber
              const today = new Date()
              const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const dayDate = inMonth
                ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNumber)
                : null
              const isPastDay = !!dayDate && dayDate < todayStart
              const isFutureDay = !!dayDate && dayDate > todayStart
              const hasUnfinishedPast = isPastDay && dayEvents.some((event) => event.estado !== 'completada')
              const hasOnlyCompletedPast = isPastDay && dayEvents.length > 0 && !hasUnfinishedPast
              const futureLines = isFutureDay ? dayEvents.slice(0, 5) : []

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => inMonth && setSelectedDay(dayNumber)}
                  className={
                    'min-h-[78px] rounded-md border p-1 text-left transition-colors relative ' +
                    (inMonth ? 'bg-background hover:bg-muted/40' : 'bg-muted/30 opacity-50') +
                    (hasUnfinishedPast
                      ? ' border-red-500 bg-red-100/70 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.45)]'
                      : dayEvents.length > 0
                        ? ' border-primary/30'
                        : ' border-border') +
                    (isSelected ? ' ring-2 ring-primary' : '')
                  }
                  disabled={!inMonth}
                >
                  {inMonth && (
                    <>
                      <div className={'text-xs font-semibold ' + (hasUnfinishedPast ? 'text-red-800' : 'text-foreground')}>
                        {dayNumber}
                      </div>

                      {hasUnfinishedPast && (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600" />
                      )}

                      <div className="mt-1 space-y-1">
                        {hasOnlyCompletedPast && (
                          <div className="h-0.5 rounded-full bg-emerald-300" />
                        )}

                        {isFutureDay && futureLines.map((event) => (
                          <div
                            key={event.id}
                            className="h-0.5 rounded-full"
                            style={{ backgroundColor: event.materia_color || '#94a3b8' }}
                          />
                        ))}

                        {isFutureDay && dayEvents.length > futureLines.length && (
                          <div className="text-[10px] text-muted-foreground">+{dayEvents.length - futureLines.length}</div>
                        )}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <h4 className="font-medium text-sm">{selectedDay ? ('Eventos del dia ' + selectedDay) : 'Selecciona un dia'}</h4>
            {selectedDayEvents.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
                {selectedDayEvents.map((event) => (
                  <Link
                    key={event.id}
                    to={'/tareas/' + event.id}
                    className="block rounded-md border p-2 hover:bg-muted/40 transition-colors"
                  >
                    <p className="text-sm font-medium truncate">{event.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">{event.materia_nombre ? `Materia: ${event.materia_nombre}` : 'Materia no asignada'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={event.estado === 'completada' ? 'success' : event.estado === 'en_progreso' ? 'secondary' : 'warning'}>
                        {event.estado === 'completada' ? 'Finalizada' : event.estado === 'en_progreso' ? 'En proceso' : 'Pendiente'}
                      </Badge>
                      {event.hora && <span className="text-xs text-muted-foreground">{event.hora}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay eventos para este dia.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/notas/nueva" className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 transition-colors flex flex-col items-center gap-2 text-muted-foreground hover:text-primary">
          <Plus className="h-8 w-8" />
          <span>Nueva Nota</span>
        </Link>
        <Link to="/materias" className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 transition-colors flex flex-col items-center gap-2 text-muted-foreground hover:text-primary">
          <BookOpen className="h-8 w-8" />
          <span>Ver Materias</span>
        </Link>
        <Link to="/tareas" className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 transition-colors flex flex-col items-center gap-2 text-muted-foreground hover:text-primary">
          <CheckSquare className="h-8 w-8" />
          <span>Ver Tareas</span>
        </Link>
        <Link to="/grabar" className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 transition-colors flex flex-col items-center gap-2 text-muted-foreground hover:text-primary">
          <Mic className="h-8 w-8" />
          <span>Grabar Audio</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={'p-3 rounded-lg ' + stat.bg}>
                  <stat.icon className={'h-6 w-6 ' + stat.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
