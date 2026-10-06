/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { revision: string | null; url: string }>
}

const SHARE_CACHE = 'm4a-share-target-v3'
const SHARE_ROUTE_PREFIX = '/shared-audio/'

function isLikelyAudio(mime: string, name: string): boolean {
  const lowerName = name.toLowerCase()
  if (mime.startsWith('audio/')) return true
  if (mime.startsWith('video/')) return true
  if (mime === 'application/octet-stream') {
    return /\.(m4a|mp3|aac|wav|ogg|oga|amr|3gp|webm)$/i.test(lowerName)
  }
  return false
}

function toAudioFile(value: FormDataEntryValue | null, fallbackName: string): File | null {
  if (!value) return null

  if (value instanceof File) {
    if (value.size === 0) return null
    return value
  }

  if (value instanceof Blob) {
    if (value.size === 0) return null
    const type = value.type || 'application/octet-stream'
    if (!isLikelyAudio(type, fallbackName)) return null
    return new File([value], fallbackName, { type })
  }

  return null
}

function extractSharedAudioFile(formData: FormData): File | null {
  const preferred = toAudioFile(formData.get('audio'), 'audio-compartido.m4a')
  if (preferred) return preferred

  for (const [key, value] of formData.entries()) {
    if (key === 'audio') continue
    const fallbackName = key.toLowerCase().includes('audio')
      ? 'audio-compartido.m4a'
      : `audio-compartido-${key}.m4a`
    const candidate = toAudioFile(value, fallbackName)
    if (candidate) return candidate
  }

  return null
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
    const shared = extractSharedAudioFile(formData)

    if (!shared) {
      return Response.redirect(`${origin}/grabar?shareError=missing-file`, 303)
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
