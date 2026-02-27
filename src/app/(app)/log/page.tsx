'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  BookOpen,
  Navigation,
  Anchor,
  Ship,
  Wrench,
  AlertTriangle,
  Plus,
  Minus,
  Loader2,
  CheckCircle,
  Fuel,
  Droplets,
  Clock,
  MapPin,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Database } from '@/lib/supabase/types'

type LogRow = Database['public']['Tables']['logs']['Row']
type LogInsert = Database['public']['Tables']['logs']['Insert']
type EntryType = NonNullable<LogRow['entry_type']>
type FuelLevel = NonNullable<LogRow['fuel_tank']>
type WaterLevel = NonNullable<LogRow['water']>

// ── Constants ────────────────────────────────────────────────────────────────

const ENTRY_TYPES: { value: EntryType; label: string; icon: typeof Navigation }[] = [
  { value: 'navigation', label: 'Navigation', icon: Navigation },
  { value: 'arrival', label: 'Arrivée', icon: Anchor },
  { value: 'departure', label: 'Départ', icon: Ship },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'incident', label: 'Incident', icon: AlertTriangle },
]

const FUEL_LEVELS: { value: FuelLevel; label: string }[] = [
  { value: 'full', label: 'Plein' },
  { value: '3/4', label: '3/4' },
  { value: 'half', label: 'Moitié' },
  { value: '1/4', label: '1/4' },
  { value: 'reserve', label: 'Réserve' },
]

const WATER_LEVELS: { value: WaterLevel; label: string }[] = [
  { value: 'full', label: 'Plein' },
  { value: '3/4', label: '3/4' },
  { value: 'half', label: 'Moitié' },
  { value: '1/4', label: '1/4' },
  { value: 'reserve', label: 'Réserve' },
]

const PROBLEM_TAGS = ['Moteur', 'Gréement', 'Électrique', 'Voile', 'Coque'] as const

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function entryTypeLabel(type: EntryType | null): string {
  return ENTRY_TYPES.find((t) => t.value === type)?.label ?? 'Journal'
}

function entryTypeBadgeColor(type: EntryType | null): string {
  switch (type) {
    case 'navigation':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    case 'arrival':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    case 'departure':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
    case 'maintenance':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'incident':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  }
}

function fuelLevelIcon(level: FuelLevel | null): string {
  switch (level) {
    case 'full': return '████'
    case '3/4': return '███░'
    case 'half': return '██░░'
    case '1/4': return '█░░░'
    case 'reserve': return '░░░░'
    default: return '—'
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LogPage() {
  const { user } = useAuth()
  const { voyage, boatStatus, loading: voyageLoading } = useActiveVoyage()

  // Form state
  const [entryType, setEntryType] = useState<EntryType>('navigation')
  const [position, setPosition] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [fuelTank, setFuelTank] = useState<FuelLevel | null>(null)
  const [jerricans, setJerricans] = useState(0)
  const [water, setWater] = useState<WaterLevel | null>(null)
  const [problemTags, setProblemTags] = useState<string[]>([])
  const [problemText, setProblemText] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // History
  const [logs, setLogs] = useState<LogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  // Auto-detect GPS position on mount (once only)
  const gpsAttempted = useRef(false)
  useEffect(() => {
    if (gpsAttempted.current) return
    gpsAttempted.current = true

    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        setLatitude(lat)
        setLongitude(lon)
        setPosition(`${lat.toFixed(4)}°N, ${lon.toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`)
      },
      (err) => {
        console.warn('GPS unavailable:', err.message)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Pre-fill position from boat status if GPS failed
  useEffect(() => {
    if (!boatStatus?.current_position) return
    if (latitude !== null) return // GPS already succeeded
    setPosition(boatStatus.current_position)
    setLatitude(boatStatus.current_lat)
    setLongitude(boatStatus.current_lon)
  }, [boatStatus, latitude])

  // Pre-fill fuel/water from boat status
  useEffect(() => {
    if (!boatStatus) return
    if (boatStatus.fuel_tank) {
      setFuelTank(boatStatus.fuel_tank as FuelLevel)
    }
    if (boatStatus.water) {
      setWater(boatStatus.water as WaterLevel)
    }
    if (boatStatus.jerricans != null) {
      setJerricans(boatStatus.jerricans)
    }
  }, [boatStatus])

  // Fetch log history
  const fetchLogs = useCallback(async () => {
    if (!voyage) {
      setLogs([])
      setLogsLoading(false)
      return
    }

    setLogsLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('voyage_id', voyage.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<LogRow[]>()

    if (error) {
      console.error('Failed to fetch logs:', error.message)
    } else {
      setLogs(data ?? [])
    }
    setLogsLoading(false)
  }, [voyage])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Save log entry
  const handleSave = async () => {
    if (!user || !voyage) return

    setSaving(true)
    const supabase = createClient()

    const combinedProblems = [
      ...problemTags,
      ...(problemText.trim() ? [problemText.trim()] : []),
    ].join(', ') || null

    const logEntry: LogInsert = {
      user_id: user.id,
      voyage_id: voyage.id,
      position: position || 'Position inconnue',
      latitude,
      longitude,
      entry_type: entryType,
      fuel_tank: fuelTank,
      jerricans,
      water,
      problems: combinedProblems,
      problem_tags: problemTags.length > 0 ? problemTags : null,
      notes: notes.trim() || null,
    }

    const { error: logError } = await supabase
      .from('logs')
      .insert(logEntry)

    if (logError) {
      console.error('Failed to save log:', logError.message)
      setToast('Erreur lors de l\'enregistrement')
      setSaving(false)
      return
    }

    // Update boat_status
    const statusUpdate: Database['public']['Tables']['boat_status']['Update'] = {
      updated_at: new Date().toISOString(),
    }

    if (latitude != null && longitude != null) {
      statusUpdate.current_lat = latitude
      statusUpdate.current_lon = longitude
      statusUpdate.current_position = position
    }
    if (fuelTank) {
      statusUpdate.fuel_tank = fuelTank
    }
    if (water) {
      statusUpdate.water = water
    }
    statusUpdate.jerricans = jerricans
    if (problemTags.length > 0) {
      statusUpdate.active_problems = problemTags
    }

    const { error: statusError } = await supabase
      .from('boat_status')
      .update(statusUpdate)
      .eq('voyage_id', voyage.id)

    if (statusError) {
      console.error('Failed to update boat status:', statusError.message)
    }

    // Reset form
    setNotes('')
    setProblemText('')
    setProblemTags([])
    setToast('Entrée enregistrée')
    setSaving(false)

    // Refresh logs
    fetchLogs()

    // Clear toast after 3s
    setTimeout(() => setToast(null), 3000)
  }

  // Toggle problem tag
  const toggleTag = (tag: string) => {
    setProblemTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  if (voyageLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <LoadingSpinner text="Chargement..." size="lg" />
      </div>
    )
  }

  if (!voyage) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6">
        <BookOpen className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="text-center text-gray-500 dark:text-gray-400">
          Aucun voyage actif. Créez-en un depuis les Paramètres.
        </p>
      </div>
    )
  }

  const nowFormatted = new Date().toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      {/* Toast */}
      {toast && (
        <div className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-sm animate-pulse rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {toast}
          </div>
        </div>
      )}

      {/* ── Log Form ────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h1 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
          Nouvelle entrée
        </h1>

        {/* Date/Time */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Date / Heure
          </label>
          <div className="flex h-11 items-center gap-2 rounded-lg bg-gray-100 px-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <Clock className="h-4 w-4 shrink-0" />
            {nowFormatted}
          </div>
        </div>

        {/* Position */}
        <div className="mb-4">
          <label
            htmlFor="position"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Position
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="position"
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Ex: 48.0244°N, 4.5389°W"
              className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Entry type */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Type d&apos;entrée
          </label>
          <div className="flex flex-wrap gap-2">
            {ENTRY_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEntryType(value)}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  entryType === value
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:active:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Fuel tank */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Fuel className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
            Carburant réservoir
          </label>
          <div className="flex flex-wrap gap-2">
            {FUEL_LEVELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFuelTank(value)}
                className={`flex min-h-[44px] min-w-[56px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  fuelTank === value
                    ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:active:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Jerricans */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Jerricans
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setJerricans((j) => Math.max(0, j - 1))}
              disabled={jerricans <= 0}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors active:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              aria-label="Retirer un jerrican"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="min-w-[2.5rem] text-center text-lg font-bold text-gray-900 dark:text-white">
              {jerricans}
            </span>
            <button
              type="button"
              onClick={() => setJerricans((j) => j + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              aria-label="Ajouter un jerrican"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Water */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Droplets className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
            Eau douce
          </label>
          <div className="flex flex-wrap gap-2">
            {WATER_LEVELS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setWater(value)}
                className={`flex min-h-[44px] min-w-[56px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  water === value
                    ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-300'
                    : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:active:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Problems */}
        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Problèmes
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {PROBLEM_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  problemTags.includes(tag)
                    ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-300'
                    : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:active:bg-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            placeholder="Détails du problème..."
            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label
            htmlFor="notes"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observations, météo, événements..."
            rows={3}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-base font-semibold text-white transition-colors hover:bg-green-700 active:bg-green-800 disabled:bg-green-400 dark:disabled:bg-green-800"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </button>
      </section>

      {/* ── Log History ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
          Historique
        </h2>

        {logsLoading ? (
          <div className="py-8">
            <LoadingSpinner text="Chargement..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-gray-400 dark:text-gray-500">
            <BookOpen className="h-10 w-10" />
            <p className="text-sm">Aucune entrée dans le journal</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
              >
                {/* Header: date + type badge */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(log.created_at)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${entryTypeBadgeColor(log.entry_type)}`}
                  >
                    {entryTypeLabel(log.entry_type)}
                  </span>
                </div>

                {/* Position */}
                {log.position && (
                  <p className="mb-1.5 flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {log.position}
                  </p>
                )}

                {/* Fuel + Water indicators */}
                <div className="mb-1.5 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                  {log.fuel_tank && (
                    <span className="flex items-center gap-1">
                      <Fuel className="h-3 w-3" />
                      {fuelLevelIcon(log.fuel_tank)} {log.fuel_tank}
                    </span>
                  )}
                  {log.jerricans > 0 && (
                    <span>Jerr. {log.jerricans}</span>
                  )}
                  {log.water && (
                    <span className="flex items-center gap-1">
                      <Droplets className="h-3 w-3" />
                      {log.water}
                    </span>
                  )}
                </div>

                {/* Problem tags */}
                {log.problem_tags && log.problem_tags.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {log.problem_tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes preview */}
                {log.notes && (
                  <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                    {log.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
