import api from './api'
import type { Tarea, TareaCreate, TareaCalendarioResponse } from '@/types'

export const tareasService = {
  getAll: async (): Promise<Tarea[]> => {
    const response = await api.get('/tareas/')
    return response.data
  },

  getPendientes: async (tipo?: string, fecha_limite?: string, materia_id?: number): Promise<Tarea[]> => {
    const params: Record<string, string | number> = {}
    if (tipo) params.tipo = tipo
    if (fecha_limite) params.fecha_limite = fecha_limite
    if (materia_id) params.materia_id = materia_id
    const response = await api.get('/tareas/pendientes', { params })
    return response.data
  },

  getById: async (id: number): Promise<Tarea> => {
    const response = await api.get('/tareas/' + id)
    return response.data
  },

  create: async (data: TareaCreate): Promise<Tarea> => {
    const response = await api.post('/tareas/', data)
    return response.data
  },

  update: async (id: number, data: Partial<TareaCreate>): Promise<Tarea> => {
    const response = await api.put('/tareas/' + id, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete('/tareas/' + id)
  },

  reorder: async (ids: number[]): Promise<void> => {
    await api.post('/tareas/reorder', ids)
  },

  getCalendario: async (mes: number, anio: number): Promise<TareaCalendarioResponse> => {
    const response = await api.get('/tareas/calendario', { params: { mes, anio } })
    return response.data
  }
}
