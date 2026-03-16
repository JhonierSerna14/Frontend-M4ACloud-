import api from './api'
import { cachedGet, markTagsDirty, paramsToKey } from './browserCache'
import type { Tarea, TareaCreate, TareaCalendarioResponse } from '@/types'

export const tareasService = {
  getAll: async (): Promise<Tarea[]> => {
    return cachedGet('tareas:list', async () => {
      const response = await api.get('/tareas/')
      return response.data
    }, {
      ttlMs: 1000 * 60 * 10,
      staleWhileRevalidateMs: 1000 * 60 * 10,
      tags: ['tareas']
    })
  },

  getPendientes: async (tipo?: string, fecha_limite?: string, materia_id?: number): Promise<Tarea[]> => {
    const params: Record<string, string | number> = {}
    if (tipo) params.tipo = tipo
    if (fecha_limite) params.fecha_limite = fecha_limite
    if (materia_id) params.materia_id = materia_id

    return cachedGet(`tareas:pendientes:${paramsToKey(params)}`, async () => {
      const response = await api.get('/tareas/pendientes', { params })
      return response.data
    }, {
      ttlMs: 1000 * 60 * 5,
      staleWhileRevalidateMs: 1000 * 60 * 5,
      tags: ['tareas']
    })
  },

  getById: async (id: number): Promise<Tarea> => {
    return cachedGet(`tarea:${id}`, async () => {
      const response = await api.get('/tareas/' + id)
      return response.data
    }, {
      ttlMs: 1000 * 60 * 10,
      staleWhileRevalidateMs: 1000 * 60 * 10,
      tags: ['tareas', `tarea:${id}`]
    })
  },

  create: async (data: TareaCreate): Promise<Tarea> => {
    const response = await api.post('/tareas/', data)
    markTagsDirty(['tareas', 'dashboard', 'calendario', 'materias'])
    return response.data
  },

  update: async (id: number, data: Partial<TareaCreate>): Promise<Tarea> => {
    const response = await api.put('/tareas/' + id, data)
    markTagsDirty(['tareas', 'dashboard', 'calendario', 'materias', `tarea:${id}`])
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete('/tareas/' + id)
    markTagsDirty(['tareas', 'dashboard', 'calendario', 'materias', `tarea:${id}`])
  },

  reorder: async (ids: number[]): Promise<void> => {
    await api.post('/tareas/reorder', ids)
    markTagsDirty(['tareas'])
  },

  getCalendario: async (mes: number, anio: number): Promise<TareaCalendarioResponse> => {
    const params = { mes, anio }
    return cachedGet(`tareas:calendario:${paramsToKey(params)}`, async () => {
      const response = await api.get('/tareas/calendario', { params })
      return response.data
    }, {
      ttlMs: 1000 * 60 * 5,
      staleWhileRevalidateMs: 1000 * 60 * 5,
      tags: ['calendario', 'tareas']
    })
  }
}
