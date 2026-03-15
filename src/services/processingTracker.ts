/**
 * Persistent tracker for audio processing tasks.
 * Survives page reloads by storing state in localStorage.
 */

const STORAGE_KEY = 'm4a_processing_tasks'

export interface ProcessingTask {
  notaId: number
  notifId: string
  startedAt: number  // timestamp
  titulo: string
}

export const processingTracker = {
  /** Get all active processing tasks */
  getAll(): ProcessingTask[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const tasks: ProcessingTask[] = JSON.parse(raw)
      // Filter out tasks older than 2 hours (stale)
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
      return tasks.filter(t => t.startedAt > twoHoursAgo)
    } catch {
      return []
    }
  },

  /** Add a new processing task */
  add(task: ProcessingTask): void {
    const tasks = this.getAll()
    // Avoid duplicates
    if (tasks.some(t => t.notaId === task.notaId)) return
    tasks.push(task)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  },

  /** Remove a processing task (completed or errored) */
  remove(notaId: number): void {
    const tasks = this.getAll().filter(t => t.notaId !== notaId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  },

  /** Clear all tasks */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  },
}
