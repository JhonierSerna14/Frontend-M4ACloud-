import api from './api'
import { cachedGet, markTagsDirty } from './browserCache'
import type { Materia, MateriaCreate } from '@/types'

export const materiasService = {
  getAll: async (): Promise<Materia[]> => {
    return cachedGet('materias:list', async () => {
      const response = await api.get('/materias/')
      return response.data
    }, {
      ttlMs: 1000 * 60 * 20,
      staleWhileRevalidateMs: 1000 * 60 * 20,
      tags: ['materias']
    })
  },

  getById: async (id: number): Promise<Materia> => {
    return cachedGet(`materias:${id}`, async () => {
      const response = await api.get('/materias/' + id)
      return response.data
    }, {
      ttlMs: 1000 * 60 * 20,
      staleWhileRevalidateMs: 1000 * 60 * 20,
      tags: ['materias']
    })
  },

  create: async (data: MateriaCreate): Promise<Materia> => {
    const response = await api.post('/materias/', data)
    markTagsDirty(['materias', 'dashboard'])
    return response.data
  },

  update: async (id: number, data: MateriaCreate): Promise<Materia> => {
    const response = await api.put('/materias/' + id, data)
    markTagsDirty(['materias', 'dashboard'])
    return response.data
  },

  updateContent: async (id: number, contenido_html: string): Promise<Materia> => {
    const response = await api.put('/materias/' + id, { contenido_html })
    markTagsDirty(['materias'])
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete('/materias/' + id)
    markTagsDirty(['materias', 'dashboard', 'notas', 'tareas', 'calendario'])
  }
}
