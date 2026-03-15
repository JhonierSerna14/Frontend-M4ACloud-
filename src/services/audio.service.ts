import api from './api'
import type { Nota } from '@/types'

export const audioService = {
  /**
   * Sube un archivo de audio y crea una nota.
   * El procesamiento (transcripción + resumen) se hace en background.
   * La nota se actualizará automáticamente cuando termine.
   */
  async uploadAudio(
    file: File,
    materiaId: number,
    titulo: string,
    fechaClase?: string,
    onUploadProgress?: (percent: number) => void
  ): Promise<Nota> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('materia_id', materiaId.toString())
    formData.append('titulo', titulo)
    if (fechaClase) {
      formData.append('fecha_clase', fechaClase)
    }
    
    const { data } = await api.post<Nota>('/notas/audio/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 1800000, // 30 minutos para audios muy largos
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onUploadProgress(percent)
        }
      }
    })
    return data
  },
}
