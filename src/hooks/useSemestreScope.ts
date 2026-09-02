import { useEffect, useRef } from 'react'
import { useSemestre } from '@/context/SemestreContext'

export function useSemestreScope() {
  const ctx = useSemestre()
  return {
    ...ctx,
    semestreId: ctx.semestreActual?.id,
  }
}

export function useOnSemestreChange(onChange: () => void) {
  const { semestreId } = useSemestreScope()
  const prevIdRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (semestreId === undefined) return
    if (prevIdRef.current !== undefined && prevIdRef.current !== semestreId) {
      onChange()
    }
    prevIdRef.current = semestreId
  }, [semestreId, onChange])
}
