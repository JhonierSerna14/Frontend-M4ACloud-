import { useState } from 'react'
import { notasService } from '@/services/notas.service'
import { useNotification } from '@/context/NotificationContext'

export function usePdfExport() {
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [exportProgress, setExportProgress] = useState(0)
  const { success, error } = useNotification()

  const exportPdf = async (id: number, titulo: string) => {
    setExportingId(id)
    setExportProgress(0)
    try {
      const blob = await notasService.exportPdf(id, (progress) => {
        setExportProgress(progress)
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = titulo + '.pdf'
      a.click()
      URL.revokeObjectURL(url)
      success('PDF exportado', 'El archivo se ha descargado')
    } catch (err) {
      error('Error', 'No se pudo exportar el PDF')
    } finally {
      setExportingId(null)
      setExportProgress(0)
    }
  }

  return { exportingId, exportProgress, exportPdf }
}
