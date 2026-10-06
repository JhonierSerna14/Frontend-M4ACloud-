/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { revision: string | null; url: string }>
}

const SHARE_CACHE = 'm4a-share-target-v4'
const SHARE_ROUTE_PREFIX = '/shared-audio/'
const SHARE_FIELD_NAMES = ['audio', 'file', 'media', 'recording', 'shared', 'files']

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    'size' in value &&
    typeof (value as Blob).arrayBuffer === 'function'
  )
}

function resolveFileName(value: Blob, fallbackName: string): string {
  const maybeFile = value as File
  if (typeof maybeFile.name === 'string' && maybeFile.name.trim()) {
    return maybeFile.name
  }
  return fallbackName
}

function toAudioFile(value: FormDataEntryValue | null, fallbackName: string): File | null {
  if (!value || typeof value === 'string') return null
  if (!isBlobLike(value)) return null
  if (value.size === 0) return null

  const name = resolveFileName(value, fallbackName)
  const type = value.type || 'application/octet-stream'
  return new File([value], name, { type })
}

function describeFormData(formData: FormData): string {
  const parts: string[] = []
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      parts.push(`${key}:string(${value.length})`)
      continue
    }
    if (isBlobLike(value)) {
      const name = resolveFileName(value, '')
      parts.push(`${key}:blob(${value.type || 'no-type'},${value.size},${name || 'no-name'})`)
      continue
    }
    parts.push(`${key}:unknown`)
  }
  return parts.join('|') || 'empty'
}

function extractSharedAudioFile(formData: FormData): { file: File | null; debug: string } {
  const debug = describeFormData(formData)
  const candidates: File[] = []

  for (const fieldName of SHARE_FIELD_NAMES) {
    for (const value of formData.getAll(fieldName)) {
      const file = toAudioFile(value, `audio-compartido-${fieldName}.m4a`)
      if (file) candidates.push(file)
    }
  }

  for (const [key, value] of formData.entries()) {
    if (SHARE_FIELD_NAMES.includes(key)) continue
    const file = toAudioFile(value, `audio-compartido-${key}.m4a`)
    if (file) candidates.push(file)
  }

  if (candidates.length === 0) {
    return { file: null, debug }
  }

  const preferred = candidates.find((file) => {
    const type = file.type.toLowerCase()
    const name = file.name.toLowerCase()
    return (
      type.startsWith('audio/') ||
      type.startsWith('video/') ||
      /\.(m4a|mp3|aac|wav|ogg|oga|amr|3gp|webm|opus)$/i.test(name)
    )
  })

  return { file: preferred ?? candidates[0], debug }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(request))
    return
  }

  if (request.method === 'GET' && url.pathname.startsWith(SHARE_ROUTE_PREFIX)) {
    event.respondWith(serveSharedAudio(request))
  }
})

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'app-shell-navigation',
    networkTimeoutSeconds: 4,
  })
)

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

async function handleShareTarget(request: Request) {
  const origin = new URL(request.url).origin

  try {
    const formData = await request.formData()
    const { file: shared, debug } = extractSharedAudioFile(formData)

    if (!shared) {
      const debugParam = encodeURIComponent(debug.slice(0, 240))
      return Response.redirect(`${origin}/grabar?shareError=missing-file&shareDebug=${debugParam}`, 303)
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const cacheKey = new Request(`${origin}${SHARE_ROUTE_PREFIX}${id}`)
    const cache = await caches.open(SHARE_CACHE)

    const body = await shared.arrayBuffer()
    await cache.put(
      cacheKey,
      new Response(body, {
        headers: {
          'Content-Type': shared.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(shared.name || 'audio-compartido.m4a'),
        },
      })
    )

    const redirectUrl = `${origin}/grabar?sharedAudio=${encodeURIComponent(id)}&sharedName=${encodeURIComponent(shared.name || 'audio-compartido.m4a')}`
    return Response.redirect(redirectUrl, 303)
  } catch (err) {
    const errorName = err instanceof Error ? err.name : ''
    if (errorName === 'QuotaExceededError') {
      return Response.redirect(`${origin}/grabar?shareError=storage-failed`, 303)
    }
    return Response.redirect(`${origin}/grabar?shareError=invalid-request`, 303)
  }
}

async function serveSharedAudio(request: Request) {
  const cache = await caches.open(SHARE_CACHE)
  const match = await cache.match(request)

  if (!match) {
    return new Response('Not found', { status: 404 })
  }

  await cache.delete(request)
  return match
}
