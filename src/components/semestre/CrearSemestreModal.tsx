import { useState } from 'react'
import { Modal, Input, Button } from '@/components/ui'
import { useSemestre } from '@/context/SemestreContext'
import { useNotification } from '@/context/NotificationContext'

interface CrearSemestreModalProps {
  isOpen: boolean
  onClose: () => void
}

const CODIGO_PATTERN = /^\d{4}-\d{2}$/

export function CrearSemestreModal({ isOpen, onClose }: CrearSemestreModalProps) {
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const { crearSemestre, isCreating } = useSemestre()
  const { success, error } = useNotification()

  const isValid = CODIGO_PATTERN.test(codigo)

  const handleClose = () => {
    setCodigo('')
    setNombre('')
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    try {
      await crearSemestre({
        codigo,
        nombre: nombre.trim() || undefined,
      })
      success('Semestre creado', `El semestre ${codigo} está activo y listo para usar`)
      handleClose()
    } catch {
      error('Error', 'No se pudo crear el semestre. Verifica que el código no exista.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo semestre">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Código del semestre</label>
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="2026-02"
            className="mt-1"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1">
            Formato YYYY-NN (ej. 2026-01, 2026-02)
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Nombre (opcional)</label>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Segundo semestre 2026"
            className="mt-1"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!isValid || isCreating}>
            {isCreating ? 'Creando...' : 'Crear semestre'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
