import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { tareasService } from '@/services/tareas.service'
import { materiasService } from '@/services/materias.service'
import { Button, Card, CardContent, Input, Loading, Badge, Modal, Select, Textarea } from '@/components/ui'
import { Plus, CheckSquare, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, getDaysUntil } from '@/lib/utils'
import { useNotification } from '@/context/NotificationContext'
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation'
import { removeTareaFromCache, patchTareasOrderInCache, upsertTareaInCache } from '@/services/entityCache'
import { useSemestre } from '@/context/SemestreContext'
import type { Tarea, TareaCreate } from '@/types'

const TIPOS = [
  { value: 'TAREA', label: 'Tarea', color: 'bg-blue-100 text-blue-800' },
  { value: 'PARCIAL', label: 'Parcial', color: 'bg-red-100 text-red-800' },
  { value: 'FINAL', label: 'Final', color: 'bg-purple-100 text-purple-800' },
  { value: 'QUIZ', label: 'Quiz', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ENTREGA', label: 'Entrega', color: 'bg-green-100 text-green-800' },
  { value: 'EXPOSICION', label: 'Exposición', color: 'bg-orange-100 text-orange-800' },
  { value: 'LECTURA', label: 'Lectura', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'OTRO', label: 'Otro', color: 'bg-gray-100 text-gray-800' }
]

const ESTADOS = ['pendiente', 'en_progreso', 'completada'] as const

const BOARD_COLUMNS = [
  { key: 'pendiente', title: 'Pendientes', tone: 'border-amber-200 bg-amber-50/40' },
  { key: 'en_progreso', title: 'En Proceso', tone: 'border-blue-200 bg-blue-50/40' },
  { key: 'completada', title: 'Finalizadas', tone: 'border-emerald-200 bg-emerald-50/40' }
] as const

const QUICK_STATUS_ACTIONS: Record<typeof ESTADOS[number], Array<{ next: typeof ESTADOS[number]; dir: 'left' | 'right'; label: string }>> = {
  pendiente: [{ next: 'en_progreso', dir: 'right', label: 'Mover a En Proceso' }],
  en_progreso: [
    { next: 'pendiente', dir: 'left', label: 'Mover a Pendiente' },
    { next: 'completada', dir: 'right', label: 'Mover a Finalizada' }
  ],
  completada: [{ next: 'pendiente', dir: 'right', label: 'Mover a Pendiente' }]
}

export function TareasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTarea, setSelectedTarea] = useState<Tarea | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [activeMobileColumn, setActiveMobileColumn] = useState<typeof BOARD_COLUMNS[number]['key']>('pendiente')
  const touchStartXRef = useRef<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const [formData, setFormData] = useState<TareaCreate>({
    titulo: '',
    materia_id: 0,
    tipo: 'TAREA',
    fecha_limite: '',
    hora_limite: '',
    prioridad: 0
  })
  const [editFormData, setEditFormData] = useState<TareaCreate>({
    titulo: '',
    descripcion: '',
    materia_id: 0,
    tipo: 'TAREA',
    fecha_limite: '',
    hora_limite: '',
    prioridad: 0,
    estado: 'pendiente'
  })

  // Filtros: Materia + Tipo + Busqueda
  const [filterMateriaId, setFilterMateriaId] = useState<number | ''>('')
  const [filterTipo, setFilterTipo] = useState<string>('')

  const queryClient = useQueryClient()
  const { success, error } = useNotification()
  const deleteConfirm = useDeleteConfirmation<Tarea>()
  const { esEditable } = useSemestre()

  const { data: tareas, isLoading } = useQuery({
    queryKey: ['tareas'],
    queryFn: tareasService.getAll
  })

  const { data: materias } = useQuery({
    queryKey: ['materias'],
    queryFn: materiasService.getAll
  })

  const createMutation = useMutation({
    mutationFn: tareasService.create,
    onSuccess: (newTask) => {
      upsertTareaInCache(queryClient, newTask)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tareas', 'calendario'] })
      success('Tarea creada', 'La tarea se ha creado correctamente')
      closeModal()
    },
    onError: () => error('Error', 'No se pudo crear la tarea')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TareaCreate> }) =>
      tareasService.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tareas'] })
      const previousTareas = queryClient.getQueryData<Tarea[]>(['tareas'])

      queryClient.setQueryData<Tarea[]>(['tareas'], (old) => {
        if (!old) return old
        return old.map((task) =>
          task.id === id
            ? { ...task, ...data, fecha_actualizacion: new Date().toISOString() }
            : task
        )
      })

      if (selectedTarea?.id === id) {
        setSelectedTarea((prev) => (prev ? { ...prev, ...data } : prev))
      }

      return { previousTareas }
    },
    onSuccess: (updatedTask) => {
      upsertTareaInCache(queryClient, updatedTask)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tareas', 'calendario'] })

      setSelectedTarea((prev) => (prev?.id === updatedTask.id ? { ...prev, ...updatedTask } : prev))
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTareas) {
        queryClient.setQueryData(['tareas'], context.previousTareas)
      }
      error('Error', 'No se pudo actualizar la tarea')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: tareasService.delete,
    onSuccess: (_void, deletedId) => {
      removeTareaFromCache(queryClient, deletedId)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tareas', 'calendario'] })
      success('Tarea eliminada', 'La tarea se ha eliminado')
    },
    onError: () => error('Error', 'No se pudo eliminar la tarea')
  })

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => tareasService.reorder(ids),
    onSuccess: (_void, orderedIds) => {
      patchTareasOrderInCache(queryClient, orderedIds)
    },
    onError: () => error('Error', 'No se pudo reordenar la lista de pendientes')
  })

  const closeModal = () => {
    setIsModalOpen(false)
    setFormData({ titulo: '', materia_id: 0, tipo: 'TAREA', fecha_limite: '', hora_limite: '', prioridad: 0 })
  }

  const navigate = useNavigate()

  const handleTareaClick = (tarea: Tarea) => {
    // Navigate to tarea route which will open modal via useEffect
    navigate('/tareas/' + tarea.id)
  }

  const closeDetailModal = () => {
    setSelectedTarea(null)
    setIsSavingEdit(false)
    // remove id from URL when closing modal
    navigate('/tareas')
  }

  const { id } = useParams<{ id?: string }>()

  const handleDragStart = (taskId: number) => {
    setDraggedTaskId(taskId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDropToEstado = (estado: typeof ESTADOS[number]) => {
    if (draggedTaskId === null) return

    const tarea = tareas?.find(t => t.id === draggedTaskId)
    if (tarea && tarea.estado !== estado) {
      updateMutation.mutate({ id: tarea.id, data: { estado } })
    }

    setDraggedTaskId(null)
  }

  const handleQuickStatusChange = (tarea: Tarea, estado: typeof ESTADOS[number]) => {
    if (tarea.estado === estado) return
    updateMutation.mutate({ id: tarea.id, data: { estado } })
  }

  const handleDropWithinPendientes = (dropTaskId: number) => {
    if (draggedTaskId === null || draggedTaskId === dropTaskId) return

    const pendientes = tareasPorEstado.pendiente
    const draggedTask = pendientes.find((t) => t.id === draggedTaskId)
    const dropTask = pendientes.find((t) => t.id === dropTaskId)

    if (!draggedTask || !dropTask) return

    const reordered = [...pendientes]
    const fromIndex = reordered.findIndex((t) => t.id === draggedTaskId)
    const toIndex = reordered.findIndex((t) => t.id === dropTaskId)
    if (fromIndex < 0 || toIndex < 0) return

    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    const reorderedIds = reordered.map((t) => t.id)

    queryClient.setQueryData(['tareas'], (old: Tarea[] | undefined) => {
      if (!old) return old

      const orderMap = new Map<number, number>()
      reorderedIds.forEach((taskId, index) => orderMap.set(taskId, index))

      return old.map((task) => {
        const newOrder = orderMap.get(task.id)
        return typeof newOrder === 'number' ? { ...task, orden: newOrder } : task
      })
    })

    reorderMutation.mutate(reorderedIds)
    setDraggedTaskId(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.titulo || !formData.materia_id || !formData.fecha_limite) return
    createMutation.mutate(formData)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTarea) return
    if (!editFormData.titulo || !editFormData.materia_id || !editFormData.fecha_limite) return

    setIsSavingEdit(true)
    updateMutation.mutate(
      { id: selectedTarea.id, data: editFormData },
      {
        onSuccess: () => {
          success('Tarea actualizada', 'Los cambios se guardaron correctamente')
          closeDetailModal()
        },
        onSettled: () => {
          setIsSavingEdit(false)
        }
      }
    )
  }

  const filteredTareas = useMemo(() => {
    const base = tareas || []
    const search = searchText.trim().toLowerCase()

    return base
      .filter((t) => {
        if (filterMateriaId && t.materia_id !== filterMateriaId) return false
        if (filterTipo && t.tipo !== filterTipo) return false
        if (!search) return true

        const hayMatchTitulo = t.titulo.toLowerCase().includes(search)
        const hayMatchDescripcion = (t.descripcion || '').toLowerCase().includes(search)
        const hayMatchMateria = (t.materia?.nombre || '').toLowerCase().includes(search)
        return hayMatchTitulo || hayMatchDescripcion || hayMatchMateria
      })
      .sort((a, b) => {
        const ordenA = a.orden ?? 0
        const ordenB = b.orden ?? 0
        if (ordenA !== ordenB) return ordenA - ordenB
        if (!a.fecha_limite && !b.fecha_limite) return 0
        if (!a.fecha_limite) return 1
        if (!b.fecha_limite) return -1
        return String(a.fecha_limite).localeCompare(String(b.fecha_limite))
      })
  }, [tareas, filterMateriaId, filterTipo, searchText])

  const tareasPorEstado = useMemo(() => {
    const pendientes = filteredTareas.filter((t) => t.estado === 'pendiente')
    const enProgreso = filteredTareas.filter((t) => t.estado === 'en_progreso')
    const completadas = filteredTareas
      .filter((t) => t.estado === 'completada')
      .sort((a, b) => {
        const fechaA = String(a.fecha_actualizacion || a.fecha_limite || a.fecha_creacion || '')
        const fechaB = String(b.fecha_actualizacion || b.fecha_limite || b.fecha_creacion || '')
        return fechaB.localeCompare(fechaA)
      })

    return {
      pendiente: pendientes,
      en_progreso: enProgreso,
      completada: completadas
    }
  }, [filteredTareas])

  const totalPendientes = tareasPorEstado.pendiente.length
  const totalCompletadas = tareasPorEstado.completada.length
  const maxCompletadasVisibles = showAllCompleted
    ? totalCompletadas
    : (totalPendientes > 0 ? Math.min(totalCompletadas, totalPendientes) : Math.min(totalCompletadas, 1))
  const hasMoreCompleted = !showAllCompleted && totalCompletadas > maxCompletadasVisibles

  const getColumnTasks = (columnKey: typeof BOARD_COLUMNS[number]['key']) => {
    return columnKey === 'completada'
      ? tareasPorEstado.completada.slice(0, maxCompletadasVisibles)
      : tareasPorEstado[columnKey]
  }

  const getColumnTotal = (columnKey: typeof BOARD_COLUMNS[number]['key']) => {
    return columnKey === 'completada'
      ? totalCompletadas
      : tareasPorEstado[columnKey].length
  }

  const columnOrder = BOARD_COLUMNS.map(c => c.key)
  const activeColumnIndex = columnOrder.indexOf(activeMobileColumn)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return
    const diff = touchStartXRef.current - e.changedTouches[0].clientX
    if (diff > 50) {
      const next = columnOrder[activeColumnIndex + 1]
      if (next) setActiveMobileColumn(next)
    } else if (diff < -50) {
      const prev = columnOrder[activeColumnIndex - 1]
      if (prev) setActiveMobileColumn(prev)
    }
    touchStartXRef.current = null
  }

  const renderBoardColumn = (column: typeof BOARD_COLUMNS[number]) => {
    const tareasColumna = getColumnTasks(column.key)
    const totalColumna = getColumnTotal(column.key)

    return (
      <Card
        key={column.key}
        className={'border-2 ' + column.tone}
        onDragOver={esEditable ? handleDragOver : undefined}
        onDrop={esEditable ? () => handleDropToEstado(column.key) : undefined}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm tracking-wide uppercase">{column.title}</h3>
            <Badge variant="outline">{tareasColumna.length}{column.key === 'completada' ? '/' + totalColumna : ''}</Badge>
          </div>

          <div className="space-y-3 min-h-[320px]">
            {tareasColumna.map((tarea) => {
              const tipo = TIPOS.find(t => t.value === tarea.tipo)
              const fechaCompleta = tarea.fecha_limite + (tarea.hora_limite ? 'T' + tarea.hora_limite : '')
              const dias = getDaysUntil(fechaCompleta)
              const isCompleted = tarea.estado === 'completada'
              const quickActions = QUICK_STATUS_ACTIONS[(tarea.estado as typeof ESTADOS[number]) || 'pendiente'] || []
              const isUpdatingThisTask = updateMutation.isPending && updateMutation.variables?.id === tarea.id

              return (
                <Card
                  key={tarea.id}
                  className={'border shadow-sm hover:shadow-md transition-shadow ' + (esEditable ? 'cursor-grab active:cursor-grabbing ' : '') + (isCompleted ? 'opacity-70' : '')}
                  draggable={esEditable}
                  onDragStart={esEditable ? () => handleDragStart(tarea.id) : undefined}
                  onDragEnd={esEditable ? () => setDraggedTaskId(null) : undefined}
                  onDragOver={esEditable && column.key === 'pendiente' ? (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  } : undefined}
                  onDrop={esEditable && column.key === 'pendiente' ? (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDropWithinPendientes(tarea.id)
                  } : undefined}
                >
                  <CardContent className="p-3 space-y-2" onClick={() => handleTareaClick(tarea)}>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={'font-medium text-sm leading-tight cursor-pointer hover:text-primary ' + (isCompleted ? 'line-through' : '')}>
                        {tarea.titulo}
                      </h4>
                      {esEditable && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteConfirm.requestDelete(tarea)
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {tipo && <Badge className={tipo.color}>{tipo.label}</Badge>}
                      {tarea.prioridad === 2 && <Badge variant="destructive">Urgente</Badge>}
                      {tarea.prioridad === 1 && <Badge variant="warning">Importante</Badge>}
                    </div>

                    <div className="min-h-[2.5rem]">
                      {column.key === 'pendiente' && tarea.descripcion ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {tarea.descripcion}
                        </p>
                      ) : (
                        <span className="invisible block text-xs">.</span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tarea.materia?.color || '#cbd5e1' }} />
                        <span>{tarea.materia?.nombre || 'Sin materia'}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatDate(fechaCompleta)}</span>
                      {!isCompleted && dias <= 3 && dias >= 0 && (
                        <Badge variant={dias === 0 ? 'destructive' : 'warning'}>
                          {dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : dias + ' dias'}
                        </Badge>
                      )}
                    </div>

                    {esEditable && (
                      <div className="flex items-center justify-end gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                        {quickActions.map((action, index) => (
                          <button
                            key={tarea.id + '-' + action.next + '-' + index}
                            type="button"
                            onClick={() => handleQuickStatusChange(tarea, action.next)}
                            disabled={isUpdatingThisTask}
                            title={action.label}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {action.dir === 'left' ? (
                              <ChevronLeft className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {column.key === 'completada' && hasMoreCompleted && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAllCompleted(true)}
              >
                Ver mas ({totalCompletadas - maxCompletadasVisibles})
              </Button>
            )}

            {tareasColumna.length === 0 && (
              <div className="h-full min-h-[120px] rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center text-sm text-muted-foreground">
                Suelta tareas aqui
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  useEffect(() => {
    if (!id) return
    const tid = Number(id)
    if (Number.isNaN(tid)) return
    tareasService.getById(tid).then((t) => {
      setSelectedTarea(t)
      queryClient.setQueryData(['tarea', tid], t)
    }).catch(() => { })
  }, [id])

  useEffect(() => {
    if (!selectedTarea) return

    setEditFormData({
      titulo: selectedTarea.titulo,
      descripcion: selectedTarea.descripcion || '',
      materia_id: selectedTarea.materia_id,
      tipo: selectedTarea.tipo,
      fecha_limite: selectedTarea.fecha_limite || '',
      hora_limite: selectedTarea.hora_limite || '',
      prioridad: selectedTarea.prioridad,
      estado: selectedTarea.estado
    })
  }, [selectedTarea])

  useEffect(() => {
    setShowAllCompleted(false)
  }, [filterMateriaId, filterTipo, searchText])

  if (isLoading) return <Loading size="lg" className="mt-12" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tablero de Tareas</h1>
        </div>
        {esEditable && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Tarea
          </Button>
        )}
      </div>

      {/* Desktop filters */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar por titulo, descripcion o materia"
                  className="pl-9"
                />
              </div>
              <Select
                value={filterMateriaId || ''}
                onChange={(e) => setFilterMateriaId(Number(e.target.value) || '')}
                options={[{ value: '', label: 'Todas las materias' }, ...(materias?.map(m => ({ value: m.id, label: m.nombre })) || [])]}
                className="mt-0"
              />
              <Select
                value={filterTipo || ''}
                onChange={(e) => setFilterTipo(e.target.value)}
                options={[{ value: '', label: 'Todos los tipos' }, ...TIPOS.map(t => ({ value: t.value, label: t.label }))]}
                className="mt-0"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile filters – inline stacked */}
      <div className="md:hidden space-y-2">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar por titulo, descripcion o materia"
            className="pl-9"
          />
        </div>
        <Select
          value={filterMateriaId || ''}
          onChange={(e) => setFilterMateriaId(Number(e.target.value) || '')}
          options={[{ value: '', label: 'Todas las materias' }, ...(materias?.map(m => ({ value: m.id, label: m.nombre })) || [])]}
          className="mt-0"
        />
        <Select
          value={filterTipo || ''}
          onChange={(e) => setFilterTipo(e.target.value)}
          options={[{ value: '', label: 'Todos los tipos' }, ...TIPOS.map(t => ({ value: t.value, label: t.label }))]}
          className="mt-0"
        />
      </div>

      {filteredTareas.length > 0 ? (
        <>
          <div className="md:hidden flex gap-2 overflow-x-auto pb-1">
            {BOARD_COLUMNS.map((column) => (
              <button
                key={column.key}
                type="button"
                onClick={() => setActiveMobileColumn(column.key)}
                className={
                  'shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors ' +
                  (activeMobileColumn === column.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border')
                }
              >
                {column.title} ({getColumnTotal(column.key)})
              </button>
            ))}
          </div>

          <div
            className="md:hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {renderBoardColumn(BOARD_COLUMNS.find((column) => column.key === activeMobileColumn) || BOARD_COLUMNS[0])}
          </div>

          <div className="hidden md:grid md:grid-cols-3 gap-4">
            {BOARD_COLUMNS.map((column) => renderBoardColumn(column))}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay tareas</h3>
            <p className="text-muted-foreground mb-4">
              {esEditable ? 'Crea tu primera tarea para empezar tu tablero' : 'Este semestre no tiene tareas'}
            </p>
            {esEditable && (
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Tarea
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Nueva Tarea" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Titulo</label>
            <Input
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ej: Entrega proyecto final"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Descripcion</label>
            <Textarea
              value={formData.descripcion || ''}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Detalles adicionales..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Materia</label>
            <Select
              value={formData.materia_id || ''}
              onChange={(e) => setFormData({ ...formData, materia_id: Number(e.target.value) })}
              placeholder="Seleccionar..."
              options={materias?.map(m => ({ value: m.id, label: m.nombre })) || []}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Tipo de evento</label>
            <Select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              options={TIPOS.map(t => ({ value: t.value, label: t.label }))}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Fecha limite</label>
              <Input
                type="date"
                value={formData.fecha_limite}
                onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Hora limite</label>
              <Input
                type="time"
                value={formData.hora_limite || ''}
                onChange={(e) => setFormData({ ...formData, hora_limite: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Prioridad</label>
            <Select
              value={formData.prioridad}
              onChange={(e) => setFormData({ ...formData, prioridad: Number(e.target.value) })}
              options={[
                { value: 0, label: 'Normal' },
                { value: 1, label: 'Importante' },
                { value: 2, label: 'Urgente' }
              ]}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" disabled={!formData.titulo || !formData.materia_id || !formData.fecha_limite}>
              Crear
            </Button>
          </div>
        </form>
      </Modal>

      {selectedTarea && (
        <Modal isOpen={!!selectedTarea} onClose={closeDetailModal} title={esEditable ? 'Editar Tarea' : 'Ver Tarea'} size="lg">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Titulo</label>
              <Input
                value={editFormData.titulo}
                onChange={(e) => setEditFormData({ ...editFormData, titulo: e.target.value })}
                placeholder="Ej: Entrega proyecto final"
                className="mt-1"
                disabled={!esEditable}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Descripcion</label>
              <Textarea
                value={editFormData.descripcion || ''}
                onChange={(e) => setEditFormData({ ...editFormData, descripcion: e.target.value })}
                placeholder="Detalles adicionales..."
                className="mt-1"
                disabled={!esEditable}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Materia</label>
                <Select
                  value={editFormData.materia_id || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, materia_id: Number(e.target.value) })}
                  options={materias?.map(m => ({ value: m.id, label: m.nombre })) || []}
                  className="mt-1"
                  disabled={!esEditable}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Estado</label>
                <Select
                  value={editFormData.estado || 'pendiente'}
                  onChange={(e) => setEditFormData({ ...editFormData, estado: e.target.value })}
                  options={[
                    { value: 'pendiente', label: 'Pendiente' },
                    { value: 'en_progreso', label: 'En progreso' },
                    { value: 'completada', label: 'Completada' }
                  ]}
                  className="mt-1"
                  disabled={!esEditable}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tipo de evento</label>
                <Select
                  value={editFormData.tipo}
                  onChange={(e) => setEditFormData({ ...editFormData, tipo: e.target.value })}
                  options={TIPOS.map(t => ({ value: t.value, label: t.label }))}
                  className="mt-1"
                  disabled={!esEditable}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Prioridad</label>
                <Select
                  value={editFormData.prioridad}
                  onChange={(e) => setEditFormData({ ...editFormData, prioridad: Number(e.target.value) })}
                  options={[
                    { value: 0, label: 'Normal' },
                    { value: 1, label: 'Importante' },
                    { value: 2, label: 'Urgente' }
                  ]}
                  className="mt-1"
                  disabled={!esEditable}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Fecha limite</label>
                <Input
                  type="date"
                  value={editFormData.fecha_limite || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, fecha_limite: e.target.value })}
                  className="mt-1"
                  disabled={!esEditable}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Hora limite</label>
                <Input
                  type="time"
                  value={editFormData.hora_limite || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, hora_limite: e.target.value })}
                  className="mt-1"
                  disabled={!esEditable}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeDetailModal}>
                {esEditable ? 'Cancelar' : 'Cerrar'}
              </Button>
              {esEditable && (
                <Button type="submit" disabled={isSavingEdit || !editFormData.titulo || !editFormData.materia_id || !editFormData.fecha_limite}>
                  {isSavingEdit ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              )}
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={deleteConfirm.cancel} title="Confirmar eliminación">
        <div className="space-y-4">
          <p>¿Estás seguro de que quieres eliminar la tarea <strong>{deleteConfirm.item?.titulo}</strong>?</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={deleteConfirm.cancel}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm.confirm((id) => deleteMutation.mutate(id))}>Eliminar</Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
