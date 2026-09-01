import { createContext, useContext, useCallback, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { semestresService } from '@/services/semestres.service'
import { useAuth } from '@/context/AuthContext'
import type { Semestre, SemestreCreate } from '@/types'

interface SemestreContextValue {
  semestreActual: Semestre | undefined
  semestres: Semestre[]
  esEditable: boolean
  isLoading: boolean
  cambiarSemestre: (semestreId: number) => Promise<void>
  crearSemestre: (data: SemestreCreate) => Promise<Semestre>
  isChanging: boolean
  isCreating: boolean
}

const SemestreContext = createContext<SemestreContextValue | undefined>(undefined)

const INVALIDATE_KEYS = ['materias', 'notas', 'tareas', 'dashboard', 'calendario'] as const

export function SemestreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

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

  const invalidateSemestreData = useCallback(() => {
    INVALIDATE_KEYS.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] })
    })
  }, [queryClient])

  const changeMutation = useMutation({
    mutationFn: semestresService.setActual,
    onSuccess: (updated) => {
      queryClient.setQueryData(['semestre-actual'], updated)
      queryClient.invalidateQueries({ queryKey: ['semestres'] })
      invalidateSemestreData()
    },
  })

  const createMutation = useMutation({
    mutationFn: semestresService.create,
    onSuccess: (created) => {
      queryClient.setQueryData(['semestre-actual'], created)
      queryClient.invalidateQueries({ queryKey: ['semestres'] })
      invalidateSemestreData()
    },
  })

  const cambiarSemestre = useCallback(async (semestreId: number) => {
    await changeMutation.mutateAsync(semestreId)
  }, [changeMutation])

  const crearSemestre = useCallback(async (data: SemestreCreate) => {
    return createMutation.mutateAsync(data)
  }, [createMutation])

  const esEditable = semestreActual?.es_editable ?? false

  return (
    <SemestreContext.Provider
      value={{
        semestreActual,
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
