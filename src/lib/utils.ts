import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function parseDateLike(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  // Treat YYYY-MM-DD as local date (avoid UTC shift causing previous day)
  const dateOnlyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2]) - 1
    const day = Number(dateOnlyMatch[3])
    return new Date(year, month, day)
  }
  const parsed = new Date(String(value))
  if (isNaN(parsed.getTime())) return null
  return parsed
}

export function formatDate(date: string | Date | null | undefined): string {
  const dateObj = parseDateLike(date)
  if (!dateObj) return 'Sin fecha'
  return format(dateObj, 'dd MMM yyyy', { locale: es })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const dateObj = parseDateLike(date)
  if (!dateObj) return 'Sin fecha'
  return format(dateObj, "dd MMM yyyy 'a las' HH:mm", { locale: es })
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  const dateObj = parseDateLike(date)
  if (!dateObj) return 'Sin fecha'
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: es })
}

export function getDaysUntil(date: string | Date | null | undefined): number {
  if (!date) return NaN
  const dateObj = new Date(date)
  if (isNaN(dateObj.getTime())) return NaN
  return differenceInDays(dateObj, new Date())
}
