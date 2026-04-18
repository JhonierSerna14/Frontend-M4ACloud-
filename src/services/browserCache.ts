type CacheEntry<T> = {
  value: T
  expiresAt: number
  tags: string[]
  cachedAt: number
}

type DirtyTags = Record<string, number>

type CachedGetOptions = {
  ttlMs: number
  tags: string[]
  staleWhileRevalidateMs?: number
  forceRefresh?: boolean
}

type CacheRevalidatedDetail<T> = {
  key: string
  value: T
  tags: string[]
  cachedAt: number
}

const CACHE_PREFIX = 'm4a:cache:'
const DIRTY_PREFIX = 'm4a:dirty:'
const CACHE_REVALIDATED_EVENT = 'm4a:cache-revalidated'
const inflight = new Map<string, Promise<unknown>>()

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

function scheduleWrite(task: () => void) {
  if (typeof window === 'undefined') {
    task()
    return
  }

  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
  if (idle) {
    idle(() => task())
    return
  }

  window.setTimeout(task, 0)
}

function getUserScope() {
  if (!canUseStorage()) return 'anon'
  const token = window.localStorage.getItem('token') || ''
  if (!token) return 'anon'
  return token.slice(0, 24)
}

function buildStorageKey(key: string) {
  return `${CACHE_PREFIX}${getUserScope()}:${key}`
}

function buildDirtyKey() {
  return `${DIRTY_PREFIX}${getUserScope()}`
}

function readDirtyTags(): DirtyTags {
  if (!canUseStorage()) return {}
  try {
    const raw = window.localStorage.getItem(buildDirtyKey())
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DirtyTags
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeDirtyTags(next: DirtyTags) {
  if (!canUseStorage()) return
  scheduleWrite(() => {
    try {
      window.localStorage.setItem(buildDirtyKey(), JSON.stringify(next))
    } catch {
      // Ignore quota/storage errors and keep app responsive.
    }
  })
}

function hasDirtyTag(tags: string[]) {
  const dirty = readDirtyTags()
  return tags.some((tag) => Boolean(dirty[tag]))
}

function clearDirtyTags(tags: string[]) {
  if (!canUseStorage() || tags.length === 0) return
  const dirty = readDirtyTags()
  let changed = false
  for (const tag of tags) {
    if (dirty[tag]) {
      delete dirty[tag]
      changed = true
    }
  }
  if (changed) {
    writeDirtyTags(dirty)
  }
}

export function markTagsDirty(tags: string[]) {
  if (!canUseStorage() || tags.length === 0) return
  const dirty = readDirtyTags()
  const now = Date.now()
  for (const tag of tags) {
    dirty[tag] = now
  }
  writeDirtyTags(dirty)
}

function readCacheEntry<T>(key: string): CacheEntry<T> | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.expiresAt !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function writeCacheEntry<T>(key: string, entry: CacheEntry<T>) {
  if (!canUseStorage()) return
  scheduleWrite(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(entry))
    } catch {
      // Ignore quota/storage errors and keep app responsive.
    }
  })
}

function emitCacheRevalidated<T>(detail: CacheRevalidatedDetail<T>) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(CACHE_REVALIDATED_EVENT, { detail }))
  } catch {
    // Ignore event dispatch errors to keep cache flow resilient.
  }
}

async function fetchAndStore<T>(
  storageKey: string,
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  tags: string[]
): Promise<T> {
  const existing = inflight.get(storageKey) as Promise<T> | undefined
  if (existing) {
    return existing
  }

  const promise = (async () => {
    const value = await fetcher()
    const cachedAt = Date.now()
    writeCacheEntry(storageKey, {
      value,
      expiresAt: cachedAt + ttlMs,
      tags,
      cachedAt,
    })
    clearDirtyTags(tags)
    emitCacheRevalidated({ key: cacheKey, value, tags, cachedAt })
    return value
  })()

  inflight.set(storageKey, promise)

  try {
    return await promise
  } finally {
    inflight.delete(storageKey)
  }
}

export async function cachedGet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CachedGetOptions
): Promise<T> {
  const storageKey = buildStorageKey(key)
  const entry = readCacheEntry<T>(storageKey)
  const now = Date.now()
  const staleWhileRevalidateMs = options.staleWhileRevalidateMs ?? 0
  const dirty = hasDirtyTag(options.tags)

  if (!options.forceRefresh && entry && !dirty) {
    if (now <= entry.expiresAt) {
      return entry.value
    }

    const canUseStale = staleWhileRevalidateMs > 0 && now <= entry.expiresAt + staleWhileRevalidateMs
    if (canUseStale) {
      void fetchAndStore(storageKey, key, fetcher, options.ttlMs, options.tags)
      return entry.value
    }
  }

  return fetchAndStore(storageKey, key, fetcher, options.ttlMs, options.tags)
}

export function getCacheRevalidatedEventName() {
  return CACHE_REVALIDATED_EVENT
}

export function clearCurrentUserCache() {
  if (!canUseStorage()) return
  const scope = `${CACHE_PREFIX}${getUserScope()}:`
  const keysToDelete: string[] = []

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith(scope)) {
      keysToDelete.push(key)
    }
  }

  scheduleWrite(() => {
    for (const key of keysToDelete) {
      window.localStorage.removeItem(key)
    }
    window.localStorage.removeItem(buildDirtyKey())
  })
}

export function paramsToKey(params: Record<string, unknown> | undefined) {
  if (!params) return ''
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))

  if (entries.length === 0) return ''

  return entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
}