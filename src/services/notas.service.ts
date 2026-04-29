import api from './api'
import { cachedGet, markTagsDirty, paramsToKey } from './browserCache'
import type { Nota, NotaCreate, NotaUpdate, Adjunto } from '@/types'

interface NotasParams {
  fecha_desde?: string
  fecha_hasta?: string
  materia_id?: number
  search?: string
}

export const notasService = {
  getAll: async (params?: NotasParams): Promise<Nota[]> => {
    const key = paramsToKey(params as Record<string, unknown> | undefined)
    return cachedGet(`notas:list:${key}`, async () => {
      const response = await api.get('/notas/', { params })
      return response.data
    }, {
      ttlMs: 1000 * 60 * 10,
      staleWhileRevalidateMs: 1000 * 60 * 10,
      tags: ['notas']
    })
  },

  getById: async (id: number): Promise<Nota> => {
    return cachedGet(`nota:${id}`, async () => {
      const response = await api.get('/notas/' + id)
      return response.data
    }, {
      ttlMs: 1000 * 60 * 10,
      staleWhileRevalidateMs: 1000 * 60 * 10,
      tags: ['notas', `nota:${id}`]
    })
  },

  getStatus: async (id: number): Promise<{ id: number; status: string; progress: number; message?: string }> => {
    const response = await api.get(`/notas/${id}/status`)
    return response.data
  },

  create: async (data: NotaCreate): Promise<Nota> => {
    const response = await api.post('/notas/', data)
    markTagsDirty(['notas', 'dashboard'])
    return response.data
  },

  update: async (id: number, data: NotaUpdate): Promise<Nota> => {
    const response = await api.put('/notas/' + id, data)
    markTagsDirty(['notas', 'dashboard', `nota:${id}`])
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete('/notas/' + id)
    markTagsDirty(['notas', 'dashboard', 'materias', `nota:${id}`])
  },

  reprocess: async ({ id, forceRetranscribe }: { id: number; forceRetranscribe?: boolean }): Promise<Nota> => {
    const response = await api.post('/notas/' + id + '/reprocess' + (forceRetranscribe ? '?force_retranscribe=true' : ''))
    markTagsDirty(['notas', `nota:${id}`])
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
    markTagsDirty(['notas', `nota:${notaId}`])
    return response.data
  }
}
