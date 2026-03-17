import axios from 'axios'
import api from './api'
import { markTagsDirty } from './browserCache'
import type { Nota } from '@/types'

function isTransientUploadError(err: unknown) {
  if (!axios.isAxiosError(err)) return false

  // Network-level failures on mobile often have no HTTP response.
  if (!err.response) return true

  const status = err.response.status
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

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
    const performUpload = async () => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('materia_id', materiaId.toString())
      formData.append('titulo', titulo)
      if (fechaClase) {
        formData.append('fecha_clase', fechaClase)
      }

      return api.post<Nota>('/notas/audio/upload', formData, {
        timeout: 1800000, // 30 minutos para audios muy largos
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onUploadProgress(percent)
          }
        }
      })
    }

    let response
    try {
      response = await performUpload()
    } catch (err) {
      if (!isTransientUploadError(err)) {
        throw err
      }

      // Single retry to absorb flaky mobile network interruptions.
      await wait(1200)
      response = await performUpload()
    }

    const { data } = response
    markTagsDirty(['notas', 'dashboard', 'materias'])
    return data
  },
}
