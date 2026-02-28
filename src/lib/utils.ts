import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale/fr'

// ── Verdict colors ──────────────────────────────────────────────────────────

export function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'GO':
      return '#22C55E'
    case 'STANDBY':
      return '#F59E0B'
    case 'NO-GO':
      return '#EF4444'
    default:
      return '#6B7280'
  }
}

export function getVerdictBgClass(verdict: string): string {
  switch (verdict) {
    case 'GO':
      return 'bg-green-500'
    case 'STANDBY':
      return 'bg-amber-500'
    case 'NO-GO':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

export function getVerdictTextClass(verdict: string): string {
  switch (verdict) {
    case 'GO':
      return 'text-green-600 dark:text-green-400'
    case 'STANDBY':
      return 'text-amber-600 dark:text-amber-400'
    case 'NO-GO':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

// ── Date formatting ─────────────────────────────────────────────────────────

export function formatDate(date: string): string {
  return format(parseISO(date), 'd MMMM yyyy', { locale: fr })
}

export function formatDateTime(date: string): string {
  return format(parseISO(date), 'd MMMM yyyy HH:mm', { locale: fr })
}

export function timeAgo(date: string | Date): string {
  const now = Date.now()
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime()
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days}j`

  return format(typeof date === 'string' ? parseISO(date) : date, 'd MMM', { locale: fr })
}

// ── Distance formatting ─────────────────────────────────────────────────────

export function formatDistance(nm: number | null, km: number | null): string {
  if (nm != null && nm > 0) {
    return `${nm} NM`
  }
  if (km != null && km > 0) {
    return `${km} km`
  }
  return '-'
}

// ── Fuel level ──────────────────────────────────────────────────────────────

export function fuelLevelToPercent(level: string): number {
  switch (level) {
    case 'full':
      return 100
    case '3/4':
      return 75
    case 'half':
      return 50
    case '1/4':
      return 25
    case 'reserve':
      return 10
    case 'empty':
      return 0
    default:
      return 0
  }
}

// ── Class name joiner ───────────────────────────────────────────────────────

export function cn(
  ...classes: (string | undefined | false | null)[]
): string {
  return classes.filter(Boolean).join(' ')
}
