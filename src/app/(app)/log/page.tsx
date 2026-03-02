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
  Camera,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { createClient } from '@/lib/supabase/client'
import { uploadLogPhotos } from '@/lib/supabase/storage'
import { queueLogEntry, getPendingLogs, removePendingLog, getPendingCount } from '@/lib/offline-queue'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Database } from '@/lib/supabase/types'

type LogRow = Database['public']['Tables']['logs']['Row']
type LogInsert = Database['public']['Tables']['logs']['Insert']
type EntryType = NonNullable<LogRow['entry_type']>
type FuelLevel = NonNullable<LogRow['fuel_tank']>
type WaterLevel = NonNullable<LogRow['water']>

type FormMode = 'closed' | 'new' | 'edit'

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

function formatDateRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "A l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays}j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
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

function entryTypeIcon(type: EntryType | null) {
  return ENTRY_TYPES.find((t) => t.value === type)?.icon ?? BookOpen
}

function fuelLabel(level: FuelLevel | null): string {
  return FUEL_LEVELS.find((f) => f.value === level)?.label ?? '—'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LogPage() {
  const { user } = useAuth()
  const { voyage, boatStatus, loading: voyageLoading } = useActiveVoyage()
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)

  // Form mode
  const [formMode, setFormMode] = useState<FormMode>('closed')
  const [editingLog, setEditingLog] = useState<LogRow | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

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
  const [photos, setPhotos] = useState<{ url: string; file: File }[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // History
  const [logs, setLogs] = useState<LogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  // ── Helpers ──────────────────────────────────────────────────────────────

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const resetForm = useCallback(() => {
    setEntryType('navigation')
    setPosition('')
    setLatitude(null)
    setLongitude(null)
    setFuelTank(boatStatus?.fuel_tank as FuelLevel ?? null)
    setJerricans(boatStatus?.jerricans ?? 0)
    setWater(boatStatus?.water as WaterLevel ?? null)
    setProblemTags([])
    setProblemText('')
    setNotes('')
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    setPhotos([])
  }, [boatStatus, photos])

  const detectGPS = () => {
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
  }

  // ── Open / Close form ──────────────────────────────────────────────────

  const openNewForm = () => {
    resetForm()
    setEditingLog(null)
    setFormMode('new')

    // Pre-fill from boat status
    if (boatStatus) {
      if (boatStatus.fuel_tank) setFuelTank(boatStatus.fuel_tank as FuelLevel)
      if (boatStatus.water) setWater(boatStatus.water as WaterLevel)
      if (boatStatus.jerricans != null) setJerricans(boatStatus.jerricans)
      if (boatStatus.current_position) {
        setPosition(boatStatus.current_position)
        setLatitude(boatStatus.current_lat)
        setLongitude(boatStatus.current_lon)
      }
    }

    // Try GPS
    detectGPS()

    // Scroll to top
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  const openEditForm = (log: LogRow) => {
    // Clean up existing photo previews
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    setPhotos([])

    setEditingLog(log)
    setFormMode('edit')
    setEntryType(log.entry_type ?? 'navigation')
    setPosition(log.position ?? '')
    setLatitude(log.latitude)
    setLongitude(log.longitude)
    setFuelTank(log.fuel_tank as FuelLevel ?? null)
    setJerricans(log.jerricans ?? 0)
    setWater(log.water as WaterLevel ?? null)
    setProblemTags(log.problem_tags ?? [])
    // Extract problem text from the problems field (minus the tags)
    const tags = log.problem_tags ?? []
    const problemParts = (log.problems ?? '').split(', ').filter((p) => !tags.includes(p))
    setProblemText(problemParts.join(', '))
    setNotes(log.notes ?? '')

    // Scroll to top
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  const closeForm = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    setPhotos([])
    setEditingLog(null)
    setFormMode('closed')
  }

  // ── Sync pending ──────────────────────────────────────────────────────

  const syncPendingLogs = useCallback(async () => {
    if (!isOnline || !voyage) return
    const pending = await getPendingLogs()
    if (pending.length === 0) return

    const supabase = createClient()
    let synced = 0

    for (const entry of pending) {
      try {
        const { error: logError } = await supabase
          .from('logs')
          .insert(entry.data as Database['public']['Tables']['logs']['Insert'])
        if (logError) continue

        if (Object.keys(entry.statusUpdate).length > 0) {
          await supabase
            .from('boat_status')
            .update(entry.statusUpdate as Database['public']['Tables']['boat_status']['Update'])
            .eq('voyage_id', entry.voyageId)
        }

        await removePendingLog(entry.id)
        synced++
      } catch {
        // Will retry next time
      }
    }

    if (synced > 0) {
      showToast(`${synced} entrée(s) synchronisée(s)`)
      fetchLogs()
    }

    const remaining = await getPendingCount()
    setPendingCount(remaining)
  }, [isOnline, voyage])

  useEffect(() => {
    syncPendingLogs()
  }, [syncPendingLogs])

  useEffect(() => {
    getPendingCount().then(setPendingCount).catch(() => {})
  }, [])

  // ── Fetch logs ──────────────────────────────────────────────────────

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

  // ── Save (create or update) ──────────────────────────────────────────

  const handleSave = async () => {
    if (!user || !voyage) return

    setSaving(true)

    const combinedProblems = [
      ...problemTags,
      ...(problemText.trim() ? [problemText.trim()] : []),
    ].join(', ') || null

    if (formMode === 'edit' && editingLog) {
      // ── UPDATE existing log ──
      const supabase = createClient()

      // Upload new photos if any
      let newPhotoUrls: string[] = []
      if (photos.length > 0) {
        const photoFiles = photos.map((p) => p.file)
        newPhotoUrls = await uploadLogPhotos(supabase, user.id, voyage.id, photoFiles)
      }
      const allPhotoUrls = [
        ...(editingLog.photo_urls ?? []),
        ...newPhotoUrls,
      ]

      const { error } = await supabase
        .from('logs')
        .update({
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
          photo_urls: allPhotoUrls.length > 0 ? allPhotoUrls : null,
        })
        .eq('id', editingLog.id)

      if (error) {
        console.error('Failed to update log:', error.message)
        showToast("Erreur lors de la mise à jour", 'error')
        setSaving(false)
        return
      }

      showToast('Entrée mise à jour')
      closeForm()
      fetchLogs()
    } else {
      // ── CREATE new log ──
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

      const statusUpdate: Database['public']['Tables']['boat_status']['Update'] = {
        updated_at: new Date().toISOString(),
      }

      if (latitude != null && longitude != null) {
        statusUpdate.current_lat = latitude
        statusUpdate.current_lon = longitude
        statusUpdate.current_position = position
      }
      if (fuelTank) statusUpdate.fuel_tank = fuelTank
      if (water) statusUpdate.water = water
      statusUpdate.jerricans = jerricans
      if (problemTags.length > 0) statusUpdate.active_problems = problemTags

      if (!isOnline) {
        await queueLogEntry({
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
          data: logEntry as unknown as Record<string, unknown>,
          statusUpdate: statusUpdate as unknown as Record<string, unknown>,
          voyageId: voyage.id,
        })
        const count = await getPendingCount()
        setPendingCount(count)
        showToast('Sauvegardé hors-ligne')
      } else {
        const supabase = createClient()

        if (photos.length > 0) {
          const photoFiles = photos.map((p) => p.file)
          const urls = await uploadLogPhotos(supabase, user.id, voyage.id, photoFiles)
          if (urls.length > 0) logEntry.photo_urls = urls
        }

        const { error: logError } = await supabase.from('logs').insert(logEntry)

        if (logError) {
          console.error('Failed to save log:', logError.message)
          showToast("Erreur lors de l'enregistrement", 'error')
          setSaving(false)
          return
        }

        await supabase
          .from('boat_status')
          .update(statusUpdate)
          .eq('voyage_id', voyage.id)

        showToast('Entrée enregistrée')
        fetchLogs()
      }

      closeForm()
    }

    setSaving(false)
  }

  // ── Delete ──────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!editingLog) return

    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('logs').delete().eq('id', editingLog.id)

    if (error) {
      console.error('Failed to delete log:', error.message)
      showToast('Erreur lors de la suppression', 'error')
      setDeleting(false)
      return
    }

    showToast('Entrée supprimée')
    closeForm()
    fetchLogs()
    setDeleting(false)
  }

  // ── Toggle problem tag ──────────────────────────────────────────────

  const toggleTag = (tag: string) => {
    setProblemTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  // ── Loading / empty states ──────────────────────────────────────────

  if (voyageLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <LoadingSpinner text="Chargement..." size="lg" />
      </div>
    )
  }

  if (!voyage) {
    return (
      <EmptyState
        illustration="sailboat"
        title="Le journal de bord attend son capitaine"
        message="Créez un voyage dans les paramètres et Bosco tiendra le journal avec vous."
      />
    )
  }

  // ── Form visible ──────────────────────────────────────────────────

  if (formMode !== 'closed') {
    const nowFormatted = new Date().toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return (
      <div ref={formRef} className="mx-auto max-w-lg px-4 py-4 pb-24">
        {/* Toast */}
        {toast && (
          <div className={`fixed left-4 right-4 top-4 z-50 mx-auto max-w-sm rounded-xl px-4 py-3 text-center text-sm font-medium text-white shadow-lg ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {toast.message}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={closeForm}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 active:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-lg font-bold text-gray-900 dark:text-white">
            {formMode === 'edit' ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
          </h1>
          {!isOnline && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              Hors-ligne
            </span>
          )}
        </div>

        {/* Date/Time */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Date / Heure
          </label>
          <div className="flex h-11 items-center gap-2 rounded-lg bg-gray-100 px-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <Clock className="h-4 w-4 shrink-0" />
            {formMode === 'edit' && editingLog
              ? formatDateTime(editingLog.created_at)
              : nowFormatted}
          </div>
        </div>

        {/* Position */}
        <div className="mb-4">
          <label htmlFor="position" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
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

        {/* Fuel + Water side by side */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Fuel className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
              Carburant
            </label>
            <div className="flex flex-col gap-1.5">
              {FUEL_LEVELS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFuelTank(value)}
                  className={`flex min-h-[40px] items-center justify-center rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                    fuelTank === value
                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Droplets className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
              Eau douce
            </label>
            <div className="flex flex-col gap-1.5">
              {WATER_LEVELS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setWater(value)}
                  className={`flex min-h-[40px] items-center justify-center rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                    water === value
                      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-300'
                      : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
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
                className={`min-h-[40px] rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  problemTags.includes(tag)
                    ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-900/30 dark:text-red-300'
                    : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
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
        <div className="mb-4">
          <label htmlFor="notes" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
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

        {/* Photos */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Camera className="mb-0.5 mr-1 inline h-3.5 w-3.5" />
            Photos
          </label>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files
              if (!files) return
              const newPhotos = Array.from(files).map((file) => ({
                url: URL.createObjectURL(file),
                file,
              }))
              setPhotos((prev) => [...prev, ...newPhotos])
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap gap-2">
            {/* Existing photos (edit mode) */}
            {formMode === 'edit' && editingLog?.photo_urls?.map((url, i) => (
              <div key={`existing-${i}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <img src={url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
            {/* New photos */}
            {photos.map((photo, i) => (
              <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <img src={photo.url} alt={`Nouvelle photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(photo.url)
                    setPhotos((prev) => prev.filter((_, j) => j !== i))
                  }}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 active:border-blue-400 active:text-blue-500 dark:border-gray-600 dark:text-gray-500"
            >
              <Camera size={20} />
              <span className="text-[10px]">Ajouter</span>
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-medium text-white transition-colors active:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-500 dark:active:bg-blue-600 dark:disabled:bg-blue-800"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {formMode === 'edit' ? 'Mise à jour...' : 'Enregistrement...'}
              </>
            ) : (
              formMode === 'edit' ? 'Mettre à jour' : 'Enregistrer l\'entrée'
            )}
          </button>

          {formMode === 'edit' && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white text-sm font-medium text-red-600 transition-colors active:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-gray-900 dark:text-red-400 dark:active:bg-red-900/20"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Supprimer cette entrée
                </>
              )}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── History view (default) ──────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-4 py-4 pb-24">
      {/* Toast */}
      {toast && (
        <div className={`fixed left-4 right-4 top-4 z-50 mx-auto max-w-sm rounded-xl px-4 py-3 text-center text-sm font-medium text-white shadow-lg ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
        }`}>
          <div className="flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {toast.message}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            Journal de bord
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {logs.length} entrée{logs.length > 1 ? 's' : ''}
            {pendingCount > 0 && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                · {pendingCount} en attente
              </span>
            )}
          </p>
        </div>
        {!isOnline && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
            Hors-ligne
          </span>
        )}
      </div>

      {/* Log history */}
      {logsLoading ? (
        <div className="py-8">
          <LoadingSpinner text="Chargement..." />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          illustration="compass"
          title="Cap sur la première entrée"
          message="Votre journal de bord est encore vierge. Notez votre premier point — même au mouillage, ça compte !"
          compact
        >
          <button
            type="button"
            onClick={openNewForm}
            className="mt-2 flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
          >
            <Plus className="h-4 w-4" />
            Nouvelle entrée
          </button>
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => {
            const TypeIcon = entryTypeIcon(log.entry_type)
            return (
              <li key={log.id}>
                <button
                  type="button"
                  onClick={() => openEditForm(log)}
                  className="w-full rounded-lg border border-gray-200/80 bg-white p-3 text-left transition-colors active:bg-gray-50 dark:border-gray-800/60 dark:bg-gray-900 dark:active:bg-gray-800"
                >
                  {/* Row 1: Icon + type + date + edit hint */}
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${entryTypeBadgeColor(log.entry_type)}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {entryTypeLabel(log.entry_type)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatDateRelative(log.created_at)}
                          </span>
                          <Pencil className="h-3 w-3 text-gray-300 dark:text-gray-600" />
                        </div>
                      </div>
                      {log.position && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {log.position}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Levels compact */}
                  <div className="mb-1 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                    {log.fuel_tank && (
                      <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                        <Fuel className="h-3 w-3" />
                        {fuelLabel(log.fuel_tank)}
                      </span>
                    )}
                    {log.jerricans > 0 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                        Jerr. {log.jerricans}
                      </span>
                    )}
                    {log.water && (
                      <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
                        <Droplets className="h-3 w-3" />
                        {WATER_LEVELS.find((w) => w.value === log.water)?.label ?? log.water}
                      </span>
                    )}
                  </div>

                  {/* Problem tags */}
                  {log.problem_tags && log.problem_tags.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1">
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

                  {/* Photos thumbnails */}
                  {log.photo_urls && log.photo_urls.length > 0 && (
                    <div className="mb-1 flex gap-1">
                      {log.photo_urls.slice(0, 4).map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="h-10 w-10 shrink-0 rounded object-cover"
                        />
                      ))}
                      {log.photo_urls.length > 4 && (
                        <span className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-xs text-gray-500 dark:bg-gray-800">
                          +{log.photo_urls.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {log.notes && (
                    <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                      {log.notes}
                    </p>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* FAB: New entry */}
      {logs.length > 0 && (
        <button
          type="button"
          onClick={openNewForm}
          className="fixed bottom-24 right-4 z-40 flex h-13 w-13 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-transform active:scale-95 dark:bg-blue-500"
          aria-label="Nouvelle entrée"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}
