import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { audioService } from '@/services/audio.service'
import { materiasService } from '@/services/materias.service'
import { notasService } from '@/services/notas.service'
import { Button, Card, CardContent, Input, Select } from '@/components/ui'
import { Mic, Square, Loader2, FileText, Sparkles, Upload, AlertCircle } from 'lucide-react'
import { useNotification } from '@/context/NotificationContext'
import ProcessingToast from '@/components/ProcessingToast'
import { processingTracker } from '@/services/processingTracker'

type RecordingState = 'idle' | 'recording' | 'ready' | 'uploading'

const TARGET_AUDIO_BITRATE = 24_000 // 24 kbps, suficiente para voz y archivos mucho más ligeros

function pickRecorderMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
  ]

  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime
      }
    } catch {
      // ignore
    }
  }
  return undefined
}

export function GrabarPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState<RecordingState>('idle')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [duracion, setDuracion] = useState(0)
  const [titulo, setTitulo] = useState('')
  const [materiaId, setMateriaId] = useState<number>(0)
  const [fechaClase, setFechaClase] = useState<string>(new Date().toISOString().split('T')[0])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [loadingSharedAudio, setLoadingSharedAudio] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  const queryClient = useQueryClient()
  const { success, error, info, loading, update, dismiss } = useNotification()
  const [processing, setProcessing] = useState<Array<{notaId:number; notifId:string}>>([])
  const sharedAudioId = searchParams.get('sharedAudio')
  const sharedAudioName = searchParams.get('sharedName') || 'audio-compartido'
  const shareError = searchParams.get('shareError')

  const { data: materias } = useQuery({
    queryKey: ['materias'],
    queryFn: materiasService.getAll
  })

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickRecorderMimeType()
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: TARGET_AUDIO_BITRATE })
        : new MediaRecorder(stream, { audioBitsPerSecond: TARGET_AUDIO_BITRATE })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const finalType = mimeType || 'audio/webm'
        const extension = finalType.includes('ogg') ? 'ogg' : 'webm'
        const blob = new Blob(chunksRef.current, { type: finalType })
        const file = new File([blob], `grabacion.${extension}`, { type: finalType })
        setAudioFile(file)
        setState('ready')
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setState('recording')
      
      const startTime = Date.now()
      timerRef.current = setInterval(() => {
        setDuracion(Math.floor((Date.now() - startTime) / 1000))
      }, 1000)

    } catch (err) {
      error('Error', 'No se pudo acceder al microfono')
    }
  }, [error])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Subir audio y crear nota - el procesamiento es en background
  const uploadAudio = useMutation({
    mutationFn: async () => {
      if (!audioFile || !titulo || !materiaId) {
        throw new Error('Faltan campos requeridos')
      }

      setUploadError(null)
      setState('uploading')
      
      const nota = await audioService.uploadAudio(audioFile, materiaId, titulo, fechaClase || undefined, (percent) => {
        setUploadProgress(percent)
      })
      return nota
    },
    onSuccess: (nota) => {
      queryClient.invalidateQueries({ queryKey: ['notas'] })

      // Mostrar notificación persistente con progreso y opción de abrir la nota
      const notifId = loading('Procesando audio', '0%', `/notas/${nota.id}`)
      setProcessing(prev => [...prev, { notaId: nota.id, notifId }])

      // Persist to localStorage so it survives page reloads
      processingTracker.add({
        notaId: nota.id,
        notifId,
        startedAt: Date.now(),
        titulo: titulo || nota.titulo || 'Audio',
      })

      // Immediately fetch current status to update toast
      notasService.getStatus(nota.id).then(st => {
        const pct = Math.max(1, Math.round(st.progress))
        const progressMsg = st.message ? `${pct}% — ${st.message}` : `${pct}%`
        update(notifId, { message: progressMsg, progress: pct })
        if (st.status === 'done') {
          update(notifId, { type: 'success', title: '✅ Procesado', message: 'Resumen listo', persistent: true })
          processingTracker.remove(nota.id)
          setTimeout(() => dismiss(notifId), 30000)
        }
      }).catch(() => {})

      success(
        '✨ Audio enviado correctamente', 
        'El procesamiento con IA comenzará automáticamente. El progreso se muestra en la esquina inferior derecha.'
      )

      // Reset form for another upload
      resetState()
    },
    onError: (err) => {
      setState('ready')
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
      setUploadError(errorMsg)
      error('Error al subir audio', errorMsg)
    }
  })

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFile(file)
      setState('ready')
    }
  }

  // Carga audio recibido desde Share Target (PWA Android)
  useEffect(() => {
    if (!sharedAudioId) return

    let cancelled = false

    const loadSharedAudio = async () => {
      setLoadingSharedAudio(true)
      try {
        const response = await fetch(`/shared-audio/${encodeURIComponent(sharedAudioId)}`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('No se encontró el archivo compartido')
        }

        const blob = await response.blob()
        const fallbackType = blob.type || 'audio/webm'
        const inferredExt = fallbackType.includes('mpeg')
          ? 'mp3'
          : fallbackType.includes('ogg')
            ? 'ogg'
            : fallbackType.includes('wav')
              ? 'wav'
              : fallbackType.includes('mp4') || fallbackType.includes('m4a')
                ? 'm4a'
                : 'webm'

        const decodedName = decodeURIComponent(sharedAudioName)
        const hasExt = /\.[a-z0-9]+$/i.test(decodedName)
        const finalName = hasExt ? decodedName : `${decodedName}.${inferredExt}`
        const file = new File([blob], finalName, { type: fallbackType })

        if (cancelled) return

        setAudioFile(file)
        setState('ready')
        setDuracion(0)
        setUploadError(null)

        if (!titulo.trim()) {
          const baseName = finalName.replace(/\.[^/.]+$/, '')
          setTitulo(baseName.slice(0, 200))
        }

        info('Audio recibido', 'Se cargó desde compartir. Completa materia y fecha para subir.')

        const next = new URLSearchParams(searchParams)
        next.delete('sharedAudio')
        next.delete('sharedName')
        setSearchParams(next, { replace: true })
      } catch (err) {
        if (!cancelled) {
          error('Error', 'No se pudo cargar el audio compartido')
        }
      } finally {
        if (!cancelled) {
          setLoadingSharedAudio(false)
        }
      }
    }

    loadSharedAudio()

    return () => {
      cancelled = true
    }
  }, [sharedAudioId, sharedAudioName, searchParams, setSearchParams, titulo, info, error])

  useEffect(() => {
    if (!shareError) return
    error('Error', 'No se pudo recibir el audio compartido en la app')
    const next = new URLSearchParams(searchParams)
    next.delete('shareError')
    setSearchParams(next, { replace: true })
  }, [shareError, searchParams, setSearchParams, error])

  const resetState = () => {
    setAudioFile(null)
    setState('idle')
    setTitulo('')
    setMateriaId(0)
    setDuracion(0)
    setFechaClase(new Date().toISOString().split('T')[0])
    setUploadError(null)
    setUploadProgress(0)
  }

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Grabar Clase</h1>
        <p className="text-muted-foreground">Graba tu clase y obtén un resumen automático con IA</p>
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center">
            {loadingSharedAudio ? (
              <>
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
                <p className="text-lg font-medium mt-4">Recibiendo audio compartido...</p>
                <p className="text-muted-foreground">Preparando archivo para subir</p>
              </>
            ) : state === 'recording' ? (
              <>
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                    <Mic className="h-10 w-10 text-red-600" />
                  </div>
                  <div className="absolute -inset-2 rounded-full border-4 border-red-400 animate-ping opacity-25" />
                </div>
                <p className="text-3xl font-mono mt-4">{formatTime(duracion)}</p>
                <p className="text-muted-foreground mt-2">Grabando...</p>
                <Button variant="destructive" className="mt-4" onClick={stopRecording}>
                  <Square className="h-4 w-4 mr-2" />
                  Detener
                </Button>
              </>
            ) : state === 'uploading' ? (
              <>
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
                <p className="text-lg font-medium mt-4">Subiendo audio... {uploadProgress > 0 ? `${uploadProgress}%` : ''}</p>
                {uploadProgress > 0 && (
                  <div className="w-full max-w-xs mt-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div style={{ width: `${uploadProgress}%` }} className="h-2 bg-primary transition-all duration-300" />
                    </div>
                  </div>
                )}
                <p className="text-muted-foreground">El procesamiento con IA comenzará automáticamente</p>
                <p className="text-xs text-muted-foreground mt-2">
                  La interfaz permanece activa mientras se procesa
                </p>
              </>
            ) : state === 'ready' && audioFile ? (
              <>
                <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center">
                  <FileText className="h-10 w-10 text-green-600" />
                </div>
                <p className="text-lg font-medium mt-4">Audio listo</p>
                <p className="text-muted-foreground">{audioFile.name}</p>
                {duracion > 0 && <p className="text-sm text-muted-foreground">{formatTime(duracion)}</p>}
                <Button variant="ghost" className="mt-2" onClick={resetState}>
                  Cambiar audio
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={startRecording}
                  className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <Mic className="h-10 w-10 text-primary" />
                </button>
                <p className="text-lg font-medium mt-4">Toca para grabar</p>
                <p className="text-muted-foreground">o sube un archivo de audio</p>
                <label className="mt-4 cursor-pointer flex items-center gap-2 text-primary hover:underline">
                  <Upload className="h-4 w-4" />
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <span>Subir archivo</span>
                </label>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {state === 'ready' && audioFile && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Configurar nota
            </h3>
            
            {uploadError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium">Título de la nota</label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Clase de Cálculo - 20 Dic"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Materia</label>
              <Select
                value={materiaId || ''}
                onChange={(e) => setMateriaId(Number(e.target.value))}
                placeholder="Seleccionar materia..."
                options={materias?.map(m => ({ value: m.id, label: m.nombre })) || []}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fecha de la clase</label>
              <Input
                type="date"
                value={fechaClase}
                onChange={(e) => setFechaClase(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button 
              className="w-full" 
              onClick={() => uploadAudio.mutate()}
              disabled={!titulo || !materiaId || uploadAudio.isPending}
            >
              {uploadAudio.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Procesar con IA
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              El audio será transcrito y se generará un resumen automáticamente.
              <br />
              <span className="text-primary">Podrás seguir usando la app mientras se procesa.</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Render processing-toasts controllers */}
      {processing.map(p => (
        <ProcessingToast key={p.notifId} notaId={p.notaId} notifId={p.notifId} onFinish={(id) => {
          processingTracker.remove(id)
          setProcessing(prev => prev.filter(x => x.notaId !== id))
        }} />
      ))}

    </div>
  )
}
