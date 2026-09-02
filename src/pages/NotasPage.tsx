import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { notasService } from '@/services/notas.service'
import { materiasService } from '@/services/materias.service'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Loading, Badge, Select } from '@/components/ui'
import { Plus, FileText, Download, Search, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { usePdfExport } from '@/hooks/usePdfExport'
import { useSemestreScope, useOnSemestreChange } from '@/hooks/useSemestreScope'

export function NotasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  const initialFechaDesde = searchParams.get('desde') || ''
  const initialFechaHasta = searchParams.get('hasta') || ''
  const initialBusqueda = searchParams.get('q') || ''
  const initialMateria = searchParams.get('materia')
  const parsedMateria = initialMateria ? Number(initialMateria) : undefined
  const initialMateriaId = Number.isNaN(parsedMateria) ? undefined : parsedMateria

  const [fechaDesde, setFechaDesde] = useState(initialFechaDesde)
  const [fechaHasta, setFechaHasta] = useState(initialFechaHasta)
  const [materiaId, setMateriaId] = useState<number | undefined>(initialMateriaId)
  const [busqueda, setBusqueda] = useState(initialBusqueda)
  const [searchText, setSearchText] = useState(initialBusqueda)

  const { exportingId, exportProgress, exportPdf } = usePdfExport()
  const { esEditable, semestreId } = useSemestreScope()

  const resetFilters = useCallback(() => {
    setMateriaId(undefined)
    setFechaDesde('')
    setFechaHasta('')
    setBusqueda('')
    setSearchText('')
  }, [])

  useOnSemestreChange(resetFilters)

  const { data: notas, isLoading } = useQuery({
    queryKey: ['notas', semestreId, { fechaDesde, fechaHasta, materiaId, busqueda }],
    queryFn: () => notasService.getAll({
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      materia_id: materiaId,
      search: busqueda || undefined
    }),
    enabled: semestreId !== undefined,
  })

  const { data: materias } = useQuery({
    queryKey: ['materias', semestreId],
    queryFn: materiasService.getAll,
    enabled: semestreId !== undefined,
  })

  useEffect(() => {
    const nextParams = new URLSearchParams()

    if (fechaDesde) nextParams.set('desde', fechaDesde)
    if (fechaHasta) nextParams.set('hasta', fechaHasta)
    if (materiaId) nextParams.set('materia', String(materiaId))
    if (busqueda) nextParams.set('q', busqueda)

    setSearchParams(nextParams, { replace: true })
  }, [fechaDesde, fechaHasta, materiaId, busqueda, setSearchParams])

  if (isLoading) return <Loading size="lg" className="mt-12" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notas</h1>
          <p className="text-muted-foreground">Tus apuntes de clase</p>
        </div>
        {esEditable && (
          <Link to="/notas/nueva">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Nota
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setBusqueda(searchText)
                    }
                    if (e.key === 'Escape') {
                      setSearchText('')
                      setBusqueda('')
                    }
                  }}
                  placeholder="Buscar notas (presiona Enter)..."
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={materiaId || ''}
              onChange={(e) => setMateriaId(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Todas las materias"
              options={[
                { value: '', label: 'Todas las materias' },
                ...(materias?.map(m => ({ value: m.id, label: m.nombre })) || [])
              ]}
              className="w-[200px]"
            />
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-auto"
              placeholder="Desde"
            />
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-auto"
              placeholder="Hasta"
            />
          </div>
        </CardContent>
      </Card>

      {notas && notas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notas.map((nota) => {
            const materiaFromList = materias?.find(m => m.id === nota.materia_id)
            const name = nota.materia?.nombre || nota.materia_nombre || materiaFromList?.nombre
            const color = nota.materia?.color || nota.materia_color || materiaFromList?.color

            return (
              <Card key={nota.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <Link to={'/notas/' + nota.id + location.search} className="flex-1">
                      <CardTitle className="text-lg hover:text-primary transition-colors">
                        {nota.titulo}
                      </CardTitle>
                    </Link>
                    <button
                      onClick={() => exportPdf(nota.id, nota.titulo)}
                      className="p-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1"
                      title="Exportar PDF"
                      disabled={exportingId === nota.id}
                    >
                      {exportingId === nota.id ? (
                        <>
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                          {exportProgress > 0 && <span className="text-[10px] font-medium">{exportProgress}%</span>}
                        </>
                      ) : (
                        <Download className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {name && (
                      <Badge style={{ backgroundColor: color ? (color + '20') : undefined, color: color || undefined }}>
                        {name}
                      </Badge>
                    )}
                    <span>{formatDate(nota.fecha_clase || nota.fecha_creacion)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {nota.status === 'queued'
                      ? 'En cola de procesamiento'
                      : nota.status === 'processing'
                        ? 'Procesando transcripción...'
                        : nota.status === 'retry'
                          ? 'Requiere reintento manual'
                          : 'Abrir para ver contenido'}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay notas</h3>
            <p className="text-muted-foreground mb-4">
              {esEditable ? 'Crea tu primera nota para empezar' : 'Este semestre no tiene notas'}
            </p>
            {esEditable && (
              <Link to="/notas/nueva">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Nota
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
