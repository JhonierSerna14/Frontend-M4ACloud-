import { useState } from 'react'

export function useDeleteConfirmation<T extends { id: number }>() {
  const [isOpen, setIsOpen] = useState(false)
  const [item, setItem] = useState<T | null>(null)

  const requestDelete = (target: T) => {
    setItem(target)
    setIsOpen(true)
  }

  const confirm = (onDelete: (id: number) => void) => {
    if (item) {
      onDelete(item.id)
      setItem(null)
      setIsOpen(false)
    }
  }

  const cancel = () => {
    setItem(null)
    setIsOpen(false)
  }

  return { isOpen, item, requestDelete, confirm, cancel }
}
