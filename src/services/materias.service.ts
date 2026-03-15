import api from './api'
import type { Materia, MateriaCreate } from '@/types'

export const materiasService = {
  getAll: async (): Promise<Materia[]> => {
    const response = await api.get('/materias/')
    return response.data
  },

  getById: async (id: number): Promise<Materia> => {
    const response = await api.get('/materias/' + id)
    return response.data
  },

  create: async (data: MateriaCreate): Promise<Materia> => {
    const response = await api.post('/materias/', data)
    return response.data
  },

  update: async (id: number, data: MateriaCreate): Promise<Materia> => {
    const response = await api.put('/materias/' + id, data)
    return response.data
  },

  updateContent: async (id: number, contenido_html: string): Promise<Materia> => {
    const response = await api.put('/materias/' + id, { contenido_html })
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete('/materias/' + id)
  }
}
