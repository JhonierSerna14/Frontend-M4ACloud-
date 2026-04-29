import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notasService } from '@/services/notas.service'
import { materiasService } from '@/services/materias.service'
import { Button, Card, CardContent, Input, Loading, Select, Modal } from '@/components/ui' 
import { RichTextEditor } from '@/components/editor'
import { ArrowLeft, Save, Download, Trash2, Loader2, Check, RotateCw } from 'lucide-react'
import { useNotification } from '@/context/NotificationContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useNotaProgress } from '@/hooks/useNotaProgress'
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation'
import { usePdfExport } from '@/hooks/usePdfExport'
import ProcessingToast from '@/components/ProcessingToast'
import { processingTracker } from '@/services/processingTracker'
import { markTagsDirty } from '@/services/browserCache'
import { upsertNotaInCache, removeNotaFromCache } from '@/services/notasCache'
import type { NotaUpdate } from '@/types'

export function NotaEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { success, error, loading } = useNotification()
  
  const isNew = !id || id === 'nueva'
  const notaId = isNew ? null : Number(id)
  const [reprocessToast, setReprocessToast] = useState<{ notaId: number; notifId: string } | null>(null)

  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [materiaId, setMateriaId] = useState<number>(0)
  const [fechaClase, setFechaClase] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [saved, setSaved] = useState(false)
  const notasSearch = location.search
  const refreshedAfterDoneRef = useRef(false)

  const { data: nota, isLoading: isLoadingNota } = useQuery({
    queryKey: ['nota', notaId],
    queryFn: () => notasService.getById(notaId!),
    enabled: !!notaId
  })

  // Progreso en tiempo real vía WebSocket
  const { status: notaStatus, refetch: refetchProgress } = useNotaProgress(notaId)

  // Cuando la nota pasa a 'done', refrescar contenido
  useEffect(() => {
    if (notaId && notaStatus === 'done' && !refreshedAfterDoneRef.current) {
      refreshedAfterDoneRef.current = true
      markTagsDirty(['notas', 'dashboard', `nota:${notaId}`])
      queryClient.invalidateQueries({ queryKey: ['nota', notaId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }

    if (notaStatus !== 'done') {
      refreshedAfterDoneRef.current = false
    }
  }, [notaId, notaStatus, queryClient])

  const { data: materias } = useQuery({
    queryKey: ['materias'],
    queryFn: materiasService.getAll
  })

  useEffect(() => {
    if (nota) {
      setTitulo(nota.titulo)
      setContenido(nota.contenido || '')
      setMateriaId(nota.materia_id)
      setFechaClase(nota.fecha_clase || '')
    }
  }, [nota])

  const createMutation = useMutation({
    mutationFn: notasService.create,
    onSuccess: (newNota) => {
      upsertNotaInCache(queryClient, newNota)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      success('Nota creada', 'La nota se ha guardado correctamente')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      navigate('/notas/' + newNota.id + notasSearch)
    },
    onError: () => error('Error', 'No se pudo crear la nota')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: NotaUpdate; showSuccessToast?: boolean }) =>
      notasService.update(id, data),
    onSuccess: (updatedNota, variables) => {
      upsertNotaInCache(queryClient, updatedNota)
      setHasChanges(false)
      setSaved(true)
      if (variables.showSuccessToast) {
        success('Nota guardada', 'Los cambios se han guardado')
      }
      setTimeout(() => setSaved(false), 2000)
    },
    onError: () => error('Error', 'No se pudo guardar la nota')
  })

  const deleteMutation = useMutation({
    mutationFn: notasService.delete,
    onSuccess: (_, deletedId) => {
      removeNotaFromCache(queryClient, deletedId)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['materias'] })
      success('Nota eliminada', 'La nota se ha eliminado')
      navigate({ pathname: '/notas', search: notasSearch })
    },
    onError: () => error('Error', 'No se pudo eliminar la nota')
  })

  const reprocessMutation = useMutation({
    mutationFn: notasService.reprocess,
    onSuccess: (nota) => {
      upsertNotaInCache(queryClient, nota)
      refetchProgress()

      // Crear notificación de progreso abajo a la derecha
      const notifId = loading('Reprocesando con IA', '0%', `/notas/${nota.id}`)
      setReprocessToast({ notaId: nota.id, notifId })
      processingTracker.add({
        notaId: nota.id,
        notifId,
        startedAt: Date.now(),
        titulo: nota.titulo || titulo || 'Reprocesamiento',
      })
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'No se pudo reprocesar'
      error('Error', msg)
    }
  })

  const autoSave = useCallback(() => {
    if (notaId && hasChanges && titulo) {
      updateMutation.mutate({
        id: notaId,
        data: { titulo, contenido, materia_id: materiaId, fecha_clase: fechaClase || null }
      })
    }
  }, [notaId, hasChanges, titulo, contenido, materiaId, fechaClase, updateMutation])

  useDebounce(autoSave, 2000, [titulo, contenido, materiaId, fechaClase])

  // Warn about unsaved changes: browser tab close / reload
  useEffect(() => {
    if (!hasChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])


  const handleSave = () => {
    if (!titulo) {
      error('Error', 'El titulo es obligatorio')
      return
    }
    if (!materiaId) {
      error('Error', 'Selecciona una materia')
      return
    }

    if (isNew) {
      createMutation.mutate({
        titulo,
        contenido,
        materia_id: materiaId,
        fecha_clase: fechaClase || undefined
      })
    } else {
      updateMutation.mutate({
        id: notaId!,
        data: { titulo, contenido, materia_id: materiaId, fecha_clase: fechaClase || null },
        showSuccessToast: true,
      })
    }
  }

  // Delete confirmation and PDF export hooks
  const deleteConfirm = useDeleteConfirmation<{ id: number }>()
  const { exportingId, exportProgress, exportPdf } = usePdfExport()
  const isExportingPdf = exportingId === notaId

  const handleImageUpload = async (file: File): Promise<string> => {
    if (!notaId) {
      error('Error', 'Guarda la nota primero para subir imagenes')
      throw new Error('Nota not saved')
    }
    const adjunto = await notasService.uploadAdjunto(notaId, file)
    return adjunto.url
  }

  const handleContentChange = (newContent: string) => {
    setContenido(newContent)
    setHasChanges(true)
    setSaved(false)
  }

  if (!isNew && isLoadingNota) return <Loading size="lg" className="mt-12" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate({ pathname: '/notas', search: notasSearch })}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <Button
                variant="outline"
                onClick={() => notaId && exportPdf(notaId, titulo)}
                disabled={isExportingPdf}
              >
                {isExportingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {exportProgress > 0 ? `${exportProgress}%` : 'Generando...'}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </>
                )}
              </Button>
              {nota?.origen_audio && notaStatus !== 'processing' && (
                <Button
                  variant="outline"
                  onClick={(e) => notaId && reprocessMutation.mutate({ id: notaId, forceRetranscribe: e.shiftKey })}
                  disabled={reprocessMutation.isPending}
                  title="Click para reprocesar con IA. Shift+Click para re-transcribir el audio completo."
                >
                  <RotateCw className={'h-4 w-4 mr-2' + (reprocessMutation.isPending ? ' animate-spin' : '')} />
                  Reprocesar
                </Button>
              )}
              <Button variant="outline" onClick={() => notaId && deleteConfirm.requestDelete({ id: notaId })}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>

              <Modal isOpen={deleteConfirm.isOpen} onClose={deleteConfirm.cancel} title="Confirmar eliminación">
                <div className="space-y-4">
                  <p>¿Estás seguro de que quieres eliminar esta nota?</p>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={deleteConfirm.cancel}>Cancelar</Button>
                    <Button variant="destructive" onClick={() => deleteConfirm.confirm((id) => deleteMutation.mutate(id))}>Eliminar</Button>
                  </div>
                </div>
              </Modal>
            </>
          )}
          <Button onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {isNew ? 'Crear' : 'Guardar'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Input
                value={titulo}
                onChange={(e) => { setTitulo(e.target.value); setHasChanges(true); setSaved(false) }}
                placeholder="Titulo de la nota"
                className="text-lg font-semibold"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={materiaId || ''}
                onChange={(e) => { setMateriaId(Number(e.target.value)); setHasChanges(true); setSaved(false) }}
                placeholder="Seleccionar materia..."
                options={materias?.map(m => ({ value: m.id, label: m.nombre })) || []}
              />
              { (materias && (materias.find(m => m.id === materiaId) || nota?.materia_color)) && (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: (materias.find(m => m.id === materiaId)?.color) || nota?.materia_color || '#cbd5e1' }} />
                </span>
              )}
            </div>

          </div>
          <div>
            <label className="text-sm text-muted-foreground">Fecha de clase</label>
            <Input
              type="date"
              value={fechaClase}
              onChange={(e) => { setFechaClase(e.target.value); setHasChanges(true); setSaved(false) }}
              className="w-auto"
            />
          </div>
        </CardContent>
      </Card>

      <RichTextEditor
        content={contenido}
        onChange={handleContentChange}
        placeholder="Escribe tus apuntes aqui..."
        onImageUpload={notaId ? handleImageUpload : undefined}
      />

      {/* Save indicator: fixed icon top-right, visible regardless of scroll */}
      <div className="fixed top-4 right-4 z-50 pointer-events-none">
        <div className="flex items-center gap-2 bg-muted/70 text-muted-foreground px-3 py-1 rounded-full backdrop-blur-sm">
          {(updateMutation.isPending || createMutation.isPending) && (
            <Loader2 className="animate-spin h-4 w-4" />
          )}
          {!(updateMutation.isPending || createMutation.isPending) && saved && (
            <Check className="h-4 w-4 text-emerald-400" />
          )}
          <span className="text-xs">
            {(updateMutation.isPending || createMutation.isPending) ? 'Guardando...' : (saved ? 'Guardado' : '')}
          </span>
        </div>
      </div>

      {reprocessToast && (
        <ProcessingToast
          notaId={reprocessToast.notaId}
          notifId={reprocessToast.notifId}
          onFinish={(id) => {
            processingTracker.remove(id)
            setReprocessToast(null)
            queryClient.invalidateQueries({ queryKey: ['nota', id] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      )}
    </div>
  )
}
