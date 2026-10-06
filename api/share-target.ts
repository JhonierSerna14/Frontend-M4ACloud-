import Busboy from 'busboy'
import type { IncomingMessage } from 'node:http'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: {
    bodyParser: false,
  },
}

type ParsedShareFile = {
  buffer: Buffer
  filename: string
  mime: string
}

function requestOrigin(req: VercelRequest): string {
  const protoHeader = req.headers['x-forwarded-proto']
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || 'https'
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || 'localhost'
  return `${proto}://${host}`
}

function redirect(res: VercelResponse, location: string) {
  res.writeHead(303, { Location: location })
  res.end()
}

function parseMultipart(req: IncomingMessage): Promise<ParsedShareFile | null> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers })
    const chunks: Buffer[] = []
    let filename = 'audio-compartido.m4a'
    let mime = 'application/octet-stream'
    let receivedBytes = 0

    busboy.on('file', (_field, file, info) => {
      if (info.filename) filename = info.filename
      if (info.mimeType) mime = info.mimeType

      file.on('data', (data: Buffer) => {
        receivedBytes += data.length
        chunks.push(data)
      })
    })

    busboy.on('error', reject)
    busboy.on('finish', () => {
      if (receivedBytes === 0) {
        resolve(null)
        return
      }
      resolve({
        buffer: Buffer.concat(chunks),
        filename,
        mime,
      })
    })

    req.pipe(busboy)
  })
}

function backendApiBase(): string {
  const raw =
    process.env.M4A_BACKEND_API_URL ||
    process.env.VITE_API_URL ||
    'https://backend-m4acloud.onrender.com/api/v1'
  return raw.replace(/\/$/, '')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = requestOrigin(req)

  if (req.method !== 'POST') {
    res.status(405).end('Method not allowed')
    return
  }

  try {
    const parsed = await parseMultipart(req)
    if (!parsed || parsed.buffer.length < 1024) {
      const debug = parsed ? `server-bytes-${parsed.buffer.length}` : 'server-empty'
      redirect(res, `${origin}/grabar?shareError=missing-file&shareDebug=${encodeURIComponent(debug)}`)
      return
    }

    const secret = process.env.SHARE_INTAKE_SECRET || process.env.WORKER_SECRET_KEY
    if (!secret) {
      redirect(res, `${origin}/grabar?shareError=invalid-request&shareDebug=server-no-secret`)
      return
    }

    const form = new FormData()
    const blob = new Blob([parsed.buffer], { type: parsed.mime || 'application/octet-stream' })
    form.append('file', blob, parsed.filename)

    const intakeResponse = await fetch(`${backendApiBase()}/audio/share-intake`, {
      method: 'POST',
      headers: {
        'X-Share-Intake-Key': secret,
      },
      body: form,
    })

    if (!intakeResponse.ok) {
      const detail = await intakeResponse.text().catch(() => '')
      const debug = encodeURIComponent(`server-backend-${intakeResponse.status}:${detail.slice(0, 80)}`)
      redirect(res, `${origin}/grabar?shareError=invalid-request&shareDebug=${debug}`)
      return
    }

    const payload = (await intakeResponse.json()) as { id?: string; filename?: string }
    if (!payload.id) {
      redirect(res, `${origin}/grabar?shareError=invalid-request&shareDebug=server-no-id`)
      return
    }

    const name = payload.filename || parsed.filename
    const loc =
      `${origin}/grabar?sharedAudio=${encodeURIComponent(payload.id)}` +
      `&sharedName=${encodeURIComponent(name)}` +
      `&sharedSource=server`

    redirect(res, loc)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    redirect(
      res,
      `${origin}/grabar?shareError=invalid-request&shareDebug=${encodeURIComponent(`server-${message.slice(0, 120)}`)}`,
    )
  }
}
