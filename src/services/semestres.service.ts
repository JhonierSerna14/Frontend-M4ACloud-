import api from './api'
import { cachedGet, markTagsDirty } from './browserCache'
import type { Semestre, SemestreCreate } from '@/types'

export const semestresService = {
  getAll: async (): Promise<Semestre[]> => {
    return cachedGet('semestres:list', async () => {
      const response = await api.get('/semestres/')
      return response.data
    }, {
      ttlMs: 1000 * 60 * 20,
      staleWhileRevalidateMs: 1000 * 60 * 20,
      tags: ['semestres']
    })
  },

  getActual: async (): Promise<Semestre> => {
    return cachedGet('semestre:actual', async () => {
      const response = await api.get('/semestres/actual')
      return response.data
    }, {
      ttlMs: 1000 * 60 * 20,
      staleWhileRevalidateMs: 1000 * 60 * 20,
      tags: ['semestres', 'semestre-actual']
    })
  },

  create: async (data: SemestreCreate): Promise<Semestre> => {
    const response = await api.post('/semestres/', data)
    markTagsDirty(['semestres', 'semestre-actual', 'materias', 'dashboard', 'notas', 'tareas', 'calendario'])
    return response.data
  },

  setActual: async (semestreId: number): Promise<Semestre> => {
    const response = await api.put('/semestres/actual', { semestre_id: semestreId })
    markTagsDirty(['semestres', 'semestre-actual', 'materias', 'dashboard', 'notas', 'tareas', 'calendario'])
    return response.data
  }
}
