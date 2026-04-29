import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { DashboardData, Materia, Nota, Tarea } from '@/types'
import { removeNotaFromCache, upsertNotaInCache } from '@/services/notasCache'

export type SyncCrudEvent = {
  event_type: 'sync.event'
  action: 'created' | 'updated' | 'deleted' | 'reordered'
  entity: 'tarea' | 'materia' | 'nota'
  id: number | null
  payload?: Record<string, unknown> | null
  affected_collections?: string[]
  occurred_at: string
}

function isArrayQueryData<T>(data: unknown): data is T[] {
  return Array.isArray(data)
}

function updateMatchingArrayQueries<T extends { id: number }>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (current: T[]) => T[]
) {
  const queries = queryClient.getQueryCache().findAll({ queryKey })
  for (const query of queries) {
    const current = query.state.data
    if (!isArrayQueryData<T>(current)) continue
    const next = updater(current)
    if (next !== current) {
      queryClient.setQueryData(query.queryKey, next)
    }
  }
}

function patchDashboard(queryClient: QueryClient, updater: (current: DashboardData) => DashboardData) {
  queryClient.setQueryData<DashboardData>(['dashboard'], (current) => {
    if (!current) return current
    return updater(current)
  })
}

function uniqueById<T extends { id: number }>(items: T[]) {
  const seen = new Set<number>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}

function normalizeTareaOrder(tareas: Tarea[]) {
  const pendientes = tareas.filter((tarea) => tarea.estado === 'pendiente')
  const pendientesOrdenadas = pendientes
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((tarea, index) => ({ ...tarea, orden: index }))

  const resto = tareas.filter((tarea) => tarea.estado !== 'pendiente')
  return [...pendientesOrdenadas, ...resto]
}

function getCalendarDayFromFechaLimite(fechaLimite?: string): string | null {
  if (!fechaLimite) return null
  const datePart = fechaLimite.split('T')[0]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart)
  if (!match) return null
  const day = Number(match[3])
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  return String(day)
}

function patchCalendarTasks(queryClient: QueryClient, tarea: Tarea) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['tareas', 'calendario'] })
  for (const query of queries) {
    const current = query.state.data as { eventos?: Record<string, Array<Record<string, unknown>>> } | undefined
    if (!current?.eventos) continue

    let changed = false
    const nextEventos = Object.fromEntries(
      Object.entries(current.eventos).map(([day, events]) => {
        const nextEvents = events.filter((event) => event.id !== tarea.id)
        if (nextEvents.length !== events.length) {
          changed = true
        }
        return [day, nextEvents]
      })
    ) as Record<string, Array<Record<string, unknown>>>

    const targetDay = getCalendarDayFromFechaLimite(tarea.fecha_limite)
    if (targetDay) {
      const dayEvents = nextEventos[targetDay] ? [...nextEventos[targetDay]] : []
      dayEvents.push({
        id: tarea.id,
        titulo: tarea.titulo,
        tipo: tarea.tipo,
        estado: tarea.estado,
        prioridad: tarea.prioridad,
        hora: tarea.hora_limite || null,
        materia_color: tarea.materia?.color || null,
        materia_nombre: tarea.materia?.nombre || null,
      })
      nextEventos[targetDay] = dayEvents
      changed = true
    }

    if (changed) {
      queryClient.setQueryData(query.queryKey, { ...current, eventos: nextEventos })
    }
  }
}

function removeCalendarTask(queryClient: QueryClient, tareaId: number) {
  const queries = queryClient.getQueryCache().findAll({ queryKey: ['tareas', 'calendario'] })
  for (const query of queries) {
    const current = query.state.data as { eventos?: Record<string, Array<Record<string, unknown>>> } | undefined
    if (!current?.eventos) continue

    let changed = false
    const nextEventos = Object.fromEntries(
      Object.entries(current.eventos).map(([day, events]) => {
        const nextEvents = events.filter((event) => event.id !== tareaId)
        if (nextEvents.length !== events.length) {
          changed = true
        }
        return [day, nextEvents]
      })
    )

    if (changed) {
      queryClient.setQueryData(query.queryKey, { ...current, eventos: nextEventos })
    }
  }
}

export function upsertTareaInCache(queryClient: QueryClient, tarea: Tarea) {
  queryClient.setQueryData(['tarea', tarea.id], tarea)

  updateMatchingArrayQueries<Tarea>(queryClient, ['tareas'], (current) => {
    const index = current.findIndex((item) => item.id === tarea.id)
    if (index === -1) return uniqueById([tarea, ...current])
    const next = [...current]
    next[index] = { ...next[index], ...tarea }
    return normalizeTareaOrder(uniqueById(next))
  })

  updateMatchingArrayQueries<Tarea>(queryClient, ['tareas', 'pendientes'], (current) => {
    const index = current.findIndex((item) => item.id === tarea.id)
    const shouldInclude = tarea.estado !== 'completada'
    if (index === -1) {
      return shouldInclude ? [tarea, ...current] : current
    }
    if (!shouldInclude) {
      return current.filter((item) => item.id !== tarea.id)
    }
    const next = [...current]
    next[index] = { ...next[index], ...tarea }
    return uniqueById(next)
  })

  patchCalendarTasks(queryClient, tarea)

  patchDashboard(queryClient, (current) => {
    const isNewPending = tarea.estado !== 'completada'
    const totalTareas = Math.max(0, current.total_tareas)
    const tareasPendientes = Math.max(0, current.tareas_pendientes)

    const nextProximas = current.proximas_tareas.some((item) => item.id === tarea.id)
      ? current.proximas_tareas.map((item) => (item.id === tarea.id ? { ...item, ...tarea } : item))
      : current.proximas_tareas

    return {
      ...current,
      total_tareas: totalTareas,
      tareas_pendientes: isNewPending ? tareasPendientes : tareasPendientes,
      proximas_tareas: uniqueById(nextProximas),
    }
  })
}

export function removeTareaFromCache(queryClient: QueryClient, tareaId: number) {
  queryClient.removeQueries({ queryKey: ['tarea', tareaId] })

  updateMatchingArrayQueries<Tarea>(queryClient, ['tareas'], (current) => current.filter((item) => item.id !== tareaId))
  updateMatchingArrayQueries<Tarea>(queryClient, ['tareas', 'pendientes'], (current) => current.filter((item) => item.id !== tareaId))
  removeCalendarTask(queryClient, tareaId)

  patchDashboard(queryClient, (current) => ({
    ...current,
    total_tareas: Math.max(0, current.total_tareas - 1),
    tareas_pendientes: Math.max(0, current.tareas_pendientes - 1),
    proximas_tareas: current.proximas_tareas.filter((item) => item.id !== tareaId),
  }))
}

export function patchTareasOrderInCache(queryClient: QueryClient, orderedIds: number[]) {
  queryClient.setQueryData<Tarea[]>(['tareas'], (current) => {
    if (!current) return current
    const orderMap = new Map<number, number>()
    orderedIds.forEach((id, index) => orderMap.set(id, index))
    return current.map((task) => {
      const nextOrder = orderMap.get(task.id)
      return typeof nextOrder === 'number' ? { ...task, orden: nextOrder } : task
    })
  })
}

export function upsertMateriaInCache(queryClient: QueryClient, materia: Materia) {
  queryClient.setQueryData(['materia', materia.id], materia)

  updateMatchingArrayQueries<Materia>(queryClient, ['materias'], (current) => {
    const index = current.findIndex((item) => item.id === materia.id)
    if (index === -1) return uniqueById([materia, ...current])
    const next = [...current]
    next[index] = { ...next[index], ...materia }
    return uniqueById(next)
  })

  patchDashboard(queryClient, (current) => ({
    ...current,
    total_materias: current.total_materias,
  }))
}

export function removeMateriaFromCache(queryClient: QueryClient, materiaId: number) {
  queryClient.removeQueries({ queryKey: ['materia', materiaId] })

  updateMatchingArrayQueries<Materia>(queryClient, ['materias'], (current) => current.filter((item) => item.id !== materiaId))

  patchDashboard(queryClient, (current) => ({
    ...current,
    total_materias: Math.max(0, current.total_materias - 1),
  }))
}

export function applySyncCrudEvent(queryClient: QueryClient, event: SyncCrudEvent) {
  if (event.entity === 'tarea') {
    if ((event.action === 'created' || event.action === 'updated') && event.payload) {
      upsertTareaInCache(queryClient, event.payload as unknown as Tarea)
      return
    }

    if (event.action === 'deleted') {
      const payload = (event.payload || {}) as { id?: number }
      const tareaId = payload.id ?? event.id
      if (typeof tareaId === 'number') {
        removeTareaFromCache(queryClient, tareaId)
      }
      return
    }

    if (event.action === 'reordered') {
      const payload = (event.payload || {}) as { ordered_ids?: number[] }
      if (Array.isArray(payload.ordered_ids)) {
        patchTareasOrderInCache(queryClient, payload.ordered_ids)
      }
      return
    }
  }

  if (event.entity === 'materia') {
    if ((event.action === 'created' || event.action === 'updated') && event.payload) {
      upsertMateriaInCache(queryClient, event.payload as unknown as Materia)
      return
    }

    if (event.action === 'deleted') {
      const payload = (event.payload || {}) as {
        id?: number
        child_ids?: { notas?: number[]; tareas?: number[] }
      }

      const materiaId = payload.id ?? event.id
      if (typeof materiaId === 'number') {
        removeMateriaFromCache(queryClient, materiaId)
      }

      for (const tareaId of payload.child_ids?.tareas || []) {
        removeTareaFromCache(queryClient, tareaId)
      }

      for (const notaId of payload.child_ids?.notas || []) {
        removeNotaFromCache(queryClient, notaId)
      }
    }
  }

  if (event.entity === 'nota') {
    if ((event.action === 'created' || event.action === 'updated') && event.payload) {
      upsertNotaInCache(queryClient, event.payload as unknown as Nota)
      return
    }

    if (event.action === 'deleted') {
      const payload = (event.payload || {}) as { id?: number }
      const notaId = payload.id ?? event.id
      if (typeof notaId === 'number') {
        removeNotaFromCache(queryClient, notaId)
      }
    }
  }
}
