import api from './api'
import { cachedGet } from './browserCache'
import type { DashboardData } from '@/types'

export const dashboardService = {
  async getDashboard(): Promise<DashboardData> {
    return cachedGet('dashboard:summary', async () => {
      const { data } = await api.get<DashboardData>('/dashboard/')
      return data
    }, {
      ttlMs: 1000 * 60 * 5,
      staleWhileRevalidateMs: 1000 * 60 * 10,
      tags: ['dashboard']
    })
  }
}
