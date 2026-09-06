import api from './api'
import type { GoogleCalendarStatus, GoogleCalendarSyncResult } from '@/types'

export const googleCalendarService = {
  getStatus: async (): Promise<GoogleCalendarStatus> => {
    const { data } = await api.get<GoogleCalendarStatus>('/google-calendar/status')
    return data
  },

  getAuthUrl: async (): Promise<string> => {
    const { data } = await api.get<{ authorization_url: string }>('/google-calendar/auth/url')
    return data.authorization_url
  },

  disconnect: async (): Promise<void> => {
    await api.post('/google-calendar/disconnect')
  },

  syncNow: async (): Promise<GoogleCalendarSyncResult> => {
    const { data } = await api.post<GoogleCalendarSyncResult>('/google-calendar/sync')
    return data
  },
}
