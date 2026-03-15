import api from './api'
import type { Nota, NotaCreate, NotaUpdate, Adjunto } from '@/types'

interface NotasParams {
  fecha_desde?: string
  fecha_hasta?: string
  materia_id?: number
  search?: string
}

export const notasService = {
  getAll: async (params?: NotasParams): Promise<Nota[]> => {
    const response = await api.get('/notas/', { params })
    return response.data
  },

  getById: async (id: number): Promise<Nota> => {
    const response = await api.get('/notas/' + id)
    return response.data
  },

  getStatus: async (id: number): Promise<{ id: number; status: string; progress: number; message?: string }> => {
    const response = await api.get(`/notas/${id}/status`)
    return response.data
  },

  create: async (data: NotaCreate): Promise<Nota> => {
    const response = await api.post('/notas/', data)
    return response.data
  },

  update: async (id: number, data: NotaUpdate): Promise<Nota> => {
    const response = await api.put('/notas/' + id, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete('/notas/' + id)
  },

  reprocess: async (id: number): Promise<Nota> => {
    const response = await api.post('/notas/' + id + '/reprocess')
    return response.data
  },

  exportPdf: async (id: number, onProgress?: (progress: number) => void): Promise<Blob> => {
    const response = await api.get('/notas/' + id + '/pdf', {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percentCompleted)
        }
      }
    })
    return response.data
  },

  uploadAdjunto: async (notaId: number, file: File): Promise<Adjunto> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/notas/' + notaId + '/adjuntos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data
  }
}
