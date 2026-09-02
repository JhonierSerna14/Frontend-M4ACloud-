import { createContext, useContext, useCallback, useRef, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { semestresService } from '@/services/semestres.service'
import { useAuth } from '@/context/AuthContext'
import type { Semestre, SemestreCreate } from '@/types'

interface SemestreContextValue {
  semestreActual: Semestre | undefined
  semestreId: number | undefined
  semestres: Semestre[]
  esEditable: boolean
  isLoading: boolean
  cambiarSemestre: (semestreId: number) => Promise<void>
  crearSemestre: (data: SemestreCreate) => Promise<Semestre>
  isChanging: boolean
  isCreating: boolean
}

const SemestreContext = createContext<SemestreContextValue | undefined>(undefined)

const DATA_QUERY_PREFIXES = ['materias', 'notas', 'tareas', 'dashboard'] as const

export function SemestreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const latestChangeRef = useRef(0)

  const { data: semestres = [], isLoading: loadingList } = useQuery({
    queryKey: ['semestres'],
    queryFn: semestresService.getAll,
    enabled: isAuthenticated,
  })

  const { data: semestreActual, isLoading: loadingActual } = useQuery({
    queryKey: ['semestre-actual'],
    queryFn: semestresService.getActual,
    enabled: isAuthenticated,
  })

  const resetSemestreData = useCallback(async () => {
    await Promise.all(
      DATA_QUERY_PREFIXES.map((key) =>
        queryClient.resetQueries({ queryKey: [key] })
      )
    )
    queryClient.removeQueries({ queryKey: ['nota'] })
    queryClient.removeQueries({ queryKey: ['tarea'] })
    queryClient.removeQueries({ queryKey: ['materia'] })
  }, [queryClient])

  const changeMutation = useMutation({
    mutationFn: semestresService.setActual,
  })

  const createMutation = useMutation({
    mutationFn: semestresService.create,
    onSuccess: async (created) => {
      queryClient.setQueryData(['semestre-actual'], created)
      await queryClient.invalidateQueries({ queryKey: ['semestres'] })
      await resetSemestreData()
    },
  })

  const cambiarSemestre = useCallback(async (semestreId: number) => {
    const changeId = ++latestChangeRef.current
    const updated = await changeMutation.mutateAsync(semestreId)
    if (changeId !== latestChangeRef.current) return
    queryClient.setQueryData(['semestre-actual'], updated)
    await queryClient.invalidateQueries({ queryKey: ['semestres'] })
    await resetSemestreData()
  }, [changeMutation, queryClient, resetSemestreData])

  const crearSemestre = useCallback(async (data: SemestreCreate) => {
    return createMutation.mutateAsync(data)
  }, [createMutation])

  const esEditable = semestreActual?.es_editable ?? false
  const semestreId = semestreActual?.id

  return (
    <SemestreContext.Provider
      value={{
        semestreActual,
        semestreId,
        semestres,
        esEditable,
        isLoading: loadingList || loadingActual,
        cambiarSemestre,
        crearSemestre,
        isChanging: changeMutation.isPending,
        isCreating: createMutation.isPending,
      }}
    >
      {children}
    </SemestreContext.Provider>
  )
}

export function useSemestre() {
  const context = useContext(SemestreContext)
  if (!context) {
    throw new Error('useSemestre debe usarse dentro de SemestreProvider')
  }
  return context
}
