/**
 * Global component that restores in-progress audio processing tasks
 * from localStorage after page reload, regardless of which page the user is on.
 * Renders ProcessingToast components for each active task.
 */
import { useEffect, useRef, useState } from 'react'
import { useNotification } from '@/context/NotificationContext'
import { useAuth } from '@/context/AuthContext'
import { processingTracker } from '@/services/processingTracker'
import { notasService } from '@/services/notas.service'
import ProcessingToast from '@/components/ProcessingToast'

export default function ProcessingRestorer() {
  const { isAuthenticated } = useAuth()
  const { loading, update } = useNotification()
  const [tasks, setTasks] = useState<Array<{ notaId: number; notifId: string }>>([])
  const restoredRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || restoredRef.current) return
    restoredRef.current = true

    const saved = processingTracker.getAll()
    if (saved.length === 0) return

    for (const task of saved) {
      notasService.getStatus(task.notaId).then(st => {
        if (st.status === 'processing' || st.status === 'pending' || st.status === 'queued') {
          const notifId = loading(
            `Procesando: ${task.titulo}`,
            st.message ? `${st.progress}% — ${st.message}` : `${st.progress}%`,
            `/notas/${task.notaId}`
          )
          // Set the progress bar value (loading() doesn't support it directly)
          update(notifId, { progress: st.progress })
          // Update tracker with new notifId
          processingTracker.remove(task.notaId)
          processingTracker.add({ ...task, notifId })
          setTasks(prev => [...prev, { notaId: task.notaId, notifId }])
        } else {
          // Already done or errored, clean up
          processingTracker.remove(task.notaId)
        }
      }).catch(() => {
        processingTracker.remove(task.notaId)
      })
    }
  }, [isAuthenticated, loading, update])

  return (
    <>
      {tasks.map(t => (
        <ProcessingToast
          key={t.notifId}
          notaId={t.notaId}
          notifId={t.notifId}
          onFinish={(id) => {
            processingTracker.remove(id)
            setTasks(prev => prev.filter(x => x.notaId !== id))
          }}
        />
      ))}
    </>
  )
}
