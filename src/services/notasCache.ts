import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { Nota } from '@/types'

type NotasListFilters = {
  fechaDesde?: string
  fechaHasta?: string
  materiaId?: number
  busqueda?: string
}

function normalizeDate(date?: string) {
  if (!date) return null
  return date.slice(0, 10)
}

function resolveNotaDate(nota: Nota) {
  return normalizeDate(nota.fecha_clase || nota.fecha_creacion)
}

function matchesSearch(nota: Nota, rawSearch?: string) {
  const search = (rawSearch || '').trim().toLowerCase()
  if (!search) return true

  const content = [nota.titulo, nota.contenido, nota.materia_nombre]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return content.includes(search)
}

function matchesDateRange(nota: Nota, fechaDesde?: string, fechaHasta?: string) {
  const noteDate = resolveNotaDate(nota)
  if (!noteDate) return true

  if (fechaDesde && noteDate < fechaDesde) return false
  if (fechaHasta && noteDate > fechaHasta) return false
  return true
}

function matchesFilters(nota: Nota, filters?: NotasListFilters) {
  if (!filters) return true

  if (filters.materiaId && nota.materia_id !== filters.materiaId) {
    return false
  }

  if (!matchesDateRange(nota, filters.fechaDesde, filters.fechaHasta)) {
    return false
  }

  if (!matchesSearch(nota, filters.busqueda)) {
    return false
  }

  return true
}

function extractNotasFilters(queryKey: QueryKey): NotasListFilters | undefined {
  if (!Array.isArray(queryKey) || queryKey[0] !== 'notas') return undefined

  const filterCandidate = queryKey[1]
  if (!filterCandidate || typeof filterCandidate !== 'object') {
    return undefined
  }

  const typed = filterCandidate as {
    fechaDesde?: string
    fechaHasta?: string
    materiaId?: number
    busqueda?: string
  }

  return {
    fechaDesde: typed.fechaDesde,
    fechaHasta: typed.fechaHasta,
    materiaId: typed.materiaId,
    busqueda: typed.busqueda,
  }
}

function patchNotaList(list: Nota[], nota: Nota, queryKey: QueryKey): Nota[] {
  const filters = extractNotasFilters(queryKey)
  const shouldInclude = matchesFilters(nota, filters)
  const index = list.findIndex((item) => item.id === nota.id)

  if (index === -1) {
    if (!shouldInclude) return list
    return [nota, ...list]
  }

  if (!shouldInclude) {
    return list.filter((item) => item.id !== nota.id)
  }

  const next = [...list]
  next[index] = { ...next[index], ...nota }
  return next
}

export function upsertNotaInCache(queryClient: QueryClient, nota: Nota) {
  queryClient.setQueryData(['nota', nota.id], nota)

  const notasQueries = queryClient.getQueryCache().findAll({ queryKey: ['notas'] })
  for (const query of notasQueries) {
    const oldData = query.state.data
    if (!Array.isArray(oldData)) continue
    const list = oldData as Nota[]
    const patched = patchNotaList(list, nota, query.queryKey)
    if (patched !== list) {
      queryClient.setQueryData(query.queryKey, patched)
    }
  }
}

export function removeNotaFromCache(queryClient: QueryClient, notaId: number) {
  queryClient.removeQueries({ queryKey: ['nota', notaId] })

  const notasQueries = queryClient.getQueryCache().findAll({ queryKey: ['notas'] })
  for (const query of notasQueries) {
    const oldData = query.state.data
    if (!Array.isArray(oldData)) continue
    const list = oldData as Nota[]
    const filtered = list.filter((item) => item.id !== notaId)
    if (filtered.length !== list.length) {
      queryClient.setQueryData(query.queryKey, filtered)
    }
  }
}

export function patchNotaProgressInCache(
  queryClient: QueryClient,
  notaId: number,
  patch: { status?: string | null; progress?: number | null }
) {
  const normalizedPatch: Partial<Nota> = {
    ...(patch.status !== undefined ? { status: patch.status || undefined } : {}),
    ...(patch.progress !== undefined && patch.progress !== null
      ? { progreso: patch.progress }
      : {}),
  }

  if (Object.keys(normalizedPatch).length === 0) return

  queryClient.setQueryData(['nota', notaId], (old: Nota | undefined) => {
    if (!old) return old
    return { ...old, ...normalizedPatch }
  })

  const notasQueries = queryClient.getQueryCache().findAll({ queryKey: ['notas'] })
  for (const query of notasQueries) {
    const oldData = query.state.data
    if (!Array.isArray(oldData)) continue
    const list = oldData as Nota[]

    let changed = false
    const next = list.map((item) => {
      if (item.id !== notaId) return item
      changed = true
      return { ...item, ...normalizedPatch }
    })

    if (changed) {
      queryClient.setQueryData(query.queryKey, next)
    }
  }
}
