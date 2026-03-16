import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { materiasService } from '@/services/materias.service'
import { Button, Card, CardContent, Input, Loading, Modal } from '@/components/ui'
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react'
import { useNotification } from '@/context/NotificationContext'
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation'
import { RichTextEditor } from '@/components/editor'
import type { Materia, MateriaCreate } from '@/types'

const COLORES = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
]

export function MateriasPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isContentModalOpen, setIsContentModalOpen] = useState(false)
  const [editingMateria, setEditingMateria] = useState<Materia | null>(null)
  const [contentMateria, setContentMateria] = useState<Materia | null>(null)
  const [contenidoHtml, setContenidoHtml] = useState('')
  const [loadingContent, setLoadingContent] = useState(false)
  const [formData, setFormData] = useState<MateriaCreate>({ nombre: '', color: COLORES[0] })
  
  const queryClient = useQueryClient()
  const { success, error } = useNotification()
  const deleteConfirm = useDeleteConfirmation<Materia>()

  const { data: materias, isLoading } = useQuery({
    queryKey: ['materias'],
    queryFn: materiasService.getAll
  })

  const createMutation = useMutation({
    mutationFn: materiasService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materias'] })
      success('Materia creada', 'La materia se ha creado correctamente')
      closeModal()
    },
    onError: () => error('Error', 'No se pudo crear la materia')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MateriaCreate }) => 
      materiasService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materias'] })
      success('Materia actualizada', 'La materia se ha actualizado correctamente')
      closeModal()
    },
    onError: () => error('Error', 'No se pudo actualizar la materia')
  })

  const deleteMutation = useMutation({
    mutationFn: materiasService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materias'] })
      success('Materia eliminada', 'La materia se ha eliminado correctamente')
    },
    onError: () => error('Error', 'No se pudo eliminar la materia')
  })

  const updateContentMutation = useMutation({
    mutationFn: ({ id, contenido_html }: { id: number; contenido_html: string }) => 
      materiasService.updateContent(id, contenido_html),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materias'] })
      success('Contenido guardado', 'El contenido se ha guardado correctamente')
      closeContentModal()
    },
    onError: () => error('Error', 'No se pudo guardar el contenido')
  })

  const openCreateModal = () => {
    setEditingMateria(null)
    setFormData({ nombre: '', color: COLORES[0] })
    setIsModalOpen(true)
  }

  const openEditModal = (materia: Materia) => {
    setEditingMateria(materia)
    setFormData({ nombre: materia.nombre, color: materia.color || COLORES[0] })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingMateria(null)
    setFormData({ nombre: '', color: COLORES[0] })
  }

  const openContentModal = async (materia: Materia) => {
    setContentMateria(materia)
    setContenidoHtml('')
    setIsContentModalOpen(true)
    setLoadingContent(true)
    try {
      const fullMateria = await materiasService.getById(materia.id)
      setContentMateria(fullMateria)
      setContenidoHtml(fullMateria.contenido_html || '')
    } catch {
      error('Error', 'No se pudo cargar el contenido de la materia')
    } finally {
      setLoadingContent(false)
    }
  }

  const closeContentModal = () => {
    setIsContentModalOpen(false)
    setContentMateria(null)
    setContenidoHtml('')
  }

  const handleSaveContent = () => {
    if (contentMateria) {
      updateContentMutation.mutate({ id: contentMateria.id, contenido_html: contenidoHtml })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre.trim()) return

    if (editingMateria) {
      updateMutation.mutate({ id: editingMateria.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  if (isLoading) return <Loading size="lg" className="mt-12" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materias</h1>
          <p className="text-muted-foreground">Administra tus materias del semestre</p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Materia
        </Button>
      </div>

      {materias && materias.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materias.map((materia) => (
            <Card key={materia.id} className="overflow-hidden">
              <div 
                className="h-2" 
                style={{ backgroundColor: materia.color || COLORES[0] }}
              />
              <CardContent 
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openContentModal(materia)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: (materia.color || COLORES[0]) + '20' }}
                    >
                      <BookOpen 
                        className="h-5 w-5" 
                        style={{ color: materia.color || COLORES[0] }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold">{materia.nombre}</h3>
                      <p className="text-sm text-muted-foreground">
                        {materia.total_notas || 0} notas - {materia.total_tareas || 0} tareas
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => openEditModal(materia)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteConfirm.requestDelete(materia)}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tienes materias</h3>
            <p className="text-muted-foreground mb-4">Crea tu primera materia para empezar</p>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Materia
            </Button>
          </CardContent>
        </Card>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingMateria ? 'Editar Materia' : 'Nueva Materia'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nombre de la materia</label>
            <Input
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Ej: Calculo Diferencial"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COLORES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={'w-8 h-8 rounded-full border-2 transition-all ' + (formData.color === color ? 'border-foreground scale-110' : 'border-transparent')}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!formData.nombre.trim()}>
              {editingMateria ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={deleteConfirm.isOpen} onClose={deleteConfirm.cancel} title="Confirmar eliminación">
        <div className="space-y-4">
          <p>¿Estás seguro de que quieres eliminar la materia <strong>{deleteConfirm.item?.nombre}</strong>? <br/> Se eliminarán todas las notas y tareas asociadas.</p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={deleteConfirm.cancel}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm.confirm((id) => deleteMutation.mutate(id))}>Eliminar</Button>
          </div>
        </div>
      </Modal>

      {/* Content editor modal */}
      <Modal 
        isOpen={isContentModalOpen} 
        onClose={closeContentModal} 
        title={contentMateria?.nombre || 'Contenido de la materia'}
        size="3xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Agrega información, links, imágenes y cualquier contenido relevante para esta materia.
          </p>
          {loadingContent ? (
            <Loading size="md" className="py-8" />
          ) : (
            <RichTextEditor
              content={contenidoHtml}
              onChange={setContenidoHtml}
              placeholder="Escribe o pega contenido aquí..."
            />
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={closeContentModal}>
              Cancelar
            </Button>
            <Button onClick={handleSaveContent} disabled={updateContentMutation.isPending || loadingContent}>
              {updateContentMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
