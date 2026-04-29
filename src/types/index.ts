export interface Usuario {
  id: number
  email: string
  nombre: string
  is_active: boolean
  fecha_creacion: string
}

export interface Materia {
  id: number
  nombre: string
  descripcion?: string
  contenido_html?: string
  color?: string
  usuario_id: number
  total_notas?: number
  total_tareas?: number
  total_archivos?: number
}

export interface MateriaCreate {
  nombre: string
  contenido_html?: string
  color?: string
}

export interface Nota {
  id: number
  titulo: string
  contenido?: string
  materia_id: number
  fecha_clase?: string
  fecha_creacion: string
  fecha_actualizacion?: string
  materia?: Materia
  materia_color?: string
  materia_nombre?: string
  adjuntos?: Adjunto[]
  origen_audio?: string
  duracion_audio?: number
  idioma_detectado?: string
  status?: string
  status_message?: string
  progreso?: number
}

export interface NotaCreate {
  titulo: string
  contenido?: string
  materia_id: number
  fecha_clase?: string
}

export interface NotaUpdate {
  titulo?: string
  contenido?: string
  materia_id?: number
  fecha_clase?: string | null
}

export interface Adjunto {
  id: number
  nombre: string
  tipo: string
  url: string
  tamaño?: number
  fecha_creacion: string
}

export interface Tarea {
  id: number
  titulo: string
  descripcion?: string
  fecha_limite?: string
  hora_limite?: string
  estado: string
  prioridad: number
  tipo: string
  materia_id: number
  fecha_creacion: string
  fecha_actualizacion?: string
  materia?: Materia
  orden?: number
  nota_id?: number
}

export interface TareaCalendarioEvento {
  id: number
  titulo: string
  tipo: string
  estado: string
  prioridad: number
  hora?: string
  materia_color?: string | null
  materia_nombre?: string | null
}

export interface TareaCalendarioResponse {
  mes: number
  anio: number
  eventos: Record<string, TareaCalendarioEvento[]>
}

export interface TareaCreate {
  titulo: string
  descripcion?: string
  tipo: string
  fecha_limite?: string
  hora_limite?: string
  prioridad: number
  materia_id: number
  nota_id?: number
  estado?: string
}

export interface DashboardData {
  total_materias: number
  total_notas: number
  total_tareas: number
  tareas_pendientes: number
  proximas_tareas: Tarea[]
  notas_recientes: Nota[]
}

export interface HoyData {
  fecha: string
  hoy: Tarea[]
  manana: Tarea[]
  total_pendientes_hoy: number
  total_pendientes_manana: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  password: string
  nombre: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface SyncConnectedEvent {
  event_type: 'sync.connected'
  protocol_version: number
  scope: 'user'
  occurred_at: string
}

export interface SyncCrudEvent {
  event_type: 'sync.event'
  action: 'created' | 'updated' | 'deleted' | 'reordered'
  entity: 'tarea' | 'materia' | 'nota'
  id: number | null
  payload?: Record<string, unknown> | null
  affected_collections?: string[]
  occurred_at: string
}
