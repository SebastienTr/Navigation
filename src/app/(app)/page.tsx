'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  Wind,
  Waves,
  Eye,
  Thermometer,
  Droplets,
  Fuel,
  Anchor,
  MapPin,
  ChevronRight,
  RefreshCw,
  Check,
  Bell,
  AlertTriangle,
  BookOpen,
  Coffee,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { timeAgo } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'

type BriefingRow = Database['public']['Tables']['briefings']['Row']
type RouteStepRow = Database['public']['Tables']['route_steps']['Row']
type LogRow = Database['public']['Tables']['logs']['Row']
type ReminderRow = Database['public']['Tables']['reminders']['Row']

const MiniMapDynamic = dynamic(() => import('@/components/map/MiniMapView'), {
  ssr: false,
  loading: () => <Skeleton className="h-40" />,
})

// ── Verdict colors ────────────────────────────────────────────────────────

const VERDICT_COLORS = {
  GO: { bg: 'bg-[#22C55E]', text: 'text-white' },
  STANDBY: { bg: 'bg-[#F59E0B]', text: 'text-white' },
  'NO-GO': { bg: 'bg-[#EF4444]', text: 'text-white' },
} as const

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Confiance haute',
  medium: 'Confiance moyenne',
  low: 'Confiance faible',
}

// ── Fuel/Water level mapping ──────────────────────────────────────────────

const LEVEL_VALUES: Record<string, number> = {
  full: 100,
  '3/4': 75,
  half: 50,
  '1/4': 25,
  reserve: 10,
  empty: 0,
}

const LEVEL_LABELS: Record<string, string> = {
  full: 'Plein',
  '3/4': '3/4',
  half: '1/2',
  '1/4': '1/4',
  reserve: 'Réserve',
  empty: 'Vide',
}

function getLevelColor(percent: number): string {
  if (percent > 50) return 'bg-green-500'
  if (percent > 25) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ── Weather types ─────────────────────────────────────────────────────────

interface WeatherCurrent {
  windSpeed: number
  windDirection: number
  windGusts: number
  waveHeight: number
  visibility: number
  temperature: number
}

function windDirectionLabel(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  const index = Math.round(degrees / 45) % 8
  return directions[index]
}

// ── PushPermissionBanner ─────────────────────────────────────────────────

function PushPermissionBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem('push_prompt_dismissed') === '1') return
    setVisible(true)
  }, [])

  if (!visible) return null

  const handleActivate = async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        setVisible(false)
      }
    } catch {
      // User denied
    }
    setVisible(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('push_prompt_dismissed', '1')
    setVisible(false)
  }

  return (
    <Card className="flex items-center gap-3 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
      <Bell size={20} className="shrink-0 text-blue-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Activez les notifications pour recevoir alertes et briefings
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 active:bg-blue-100 dark:text-blue-400"
        >
          Plus tard
        </button>
        <button
          type="button"
          onClick={handleActivate}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white active:bg-blue-700"
        >
          Activer
        </button>
      </div>
    </Card>
  )
}

// ── MateMessages ─────────────────────────────────────────────────────────

interface MateAlert {
  key: string
  icon: React.ReactNode
  message: string
  color: string
}

function MateMessages({
  latestLog,
  fuelTank,
  pendingReminders,
  hasBriefingToday,
}: {
  latestLog: LogRow | null
  fuelTank: string | null
  pendingReminders: ReminderRow[]
  hasBriefingToday: boolean
}) {
  const alerts: MateAlert[] = []

  // Check last log > 12h
  if (latestLog) {
    const logAge = Date.now() - new Date(latestLog.created_at).getTime()
    const hoursAgo = Math.round(logAge / (1000 * 60 * 60))
    if (hoursAgo >= 12) {
      alerts.push({
        key: 'log',
        icon: <BookOpen size={14} />,
        message: `Pas de journal depuis ${hoursAgo}h`,
        color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      })
    }
  }

  // Low fuel
  const fuelPercent = LEVEL_VALUES[fuelTank ?? ''] ?? 100
  if (fuelPercent <= 25 && fuelTank) {
    alerts.push({
      key: 'fuel',
      icon: <Fuel size={14} />,
      message: 'Niveau carburant bas',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    })
  }

  // Pending reminders
  for (const reminder of pendingReminders) {
    alerts.push({
      key: `reminder-${reminder.id}`,
      icon: <AlertTriangle size={14} />,
      message: reminder.message,
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    })
  }

  // No briefing today
  if (!hasBriefingToday) {
    alerts.push({
      key: 'briefing',
      icon: <Coffee size={14} />,
      message: 'Briefing du jour non disponible',
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    })
  }

  if (alerts.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {alerts.map((alert) => (
        <span
          key={alert.key}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${alert.color}`}
        >
          {alert.icon}
          {alert.message}
        </span>
      ))}
    </div>
  )
}

// ── VerdictCard ───────────────────────────────────────────────────────────

function VerdictCard({
  briefing,
  loading,
}: {
  briefing: BriefingRow | null
  loading: boolean
}) {
  const router = useRouter()

  if (loading) {
    return <Skeleton className="h-[120px]" />
  }

  // No briefing at all → don't render (MateMessages handles the notification)
  if (!briefing) return null

  // Briefing exists but no verdict → show compact summary
  if (!briefing.verdict) {
    return (
      <Card
        className="border-l-4 border-gray-300 dark:border-gray-600"
        onClick={() => router.push('/briefings')}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Briefing du {new Date(briefing.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </p>
          <ChevronRight size={16} className="text-gray-400" />
        </div>
        {(briefing.wind || briefing.sea) && (
          <div className="mt-1 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
            {briefing.wind && <span><Wind size={12} className="mr-1 inline" />{briefing.wind}</span>}
            {briefing.sea && <span><Waves size={12} className="mr-1 inline" />{briefing.sea}</span>}
          </div>
        )}
      </Card>
    )
  }

  const colors = VERDICT_COLORS[briefing.verdict]

  return (
    <Card
      className={`${colors.bg} ${colors.text} flex min-h-[120px] flex-col items-center justify-center gap-2 shadow-md`}
      onClick={() => router.push('/briefings')}
    >
      <p className="text-sm font-medium uppercase tracking-wider opacity-90">
        Verdict du jour
      </p>
      <p className="text-4xl font-black tracking-tight">{briefing.verdict}</p>
      {briefing.confidence && (
        <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium">
          {CONFIDENCE_LABELS[briefing.confidence] ?? briefing.confidence}
        </span>
      )}
      {briefing.destination && (
        <p className="mt-1 text-sm opacity-90">
          <MapPin size={14} className="mr-1 inline" />
          {briefing.destination}
        </p>
      )}
      <p className="mt-1 text-[10px] opacity-70">
        {timeAgo(briefing.created_at)}
      </p>
    </Card>
  )
}

// ── WeatherSummary ────────────────────────────────────────────────────────

function WeatherSummary({
  lat,
  lon,
}: {
  lat: number | null
  lon: number | null
}) {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchWeather = useCallback(async () => {
    if (lat === null || lon === null) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(
        `/api/weather?lat=${lat}&lon=${lon}&hours=1`
      )
      if (!res.ok) throw new Error('Weather fetch failed')

      const data: { hourly: WeatherCurrent[] } = await res.json()
      if (data.hourly && data.hourly.length > 0) {
        setWeather(data.hourly[0])
      }
    } catch (err) {
      console.error('Failed to fetch weather:', err)
    } finally {
      setLoading(false)
    }
  }, [lat, lon])

  useEffect(() => {
    fetchWeather()
  }, [fetchWeather])

  if (loading) {
    return <Skeleton className="h-[120px]" />
  }

  if (!weather) {
    return (
      <Card>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Position inconnue — météo indisponible
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Météo actuelle
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <WeatherMetric
          icon={<Wind size={16} />}
          label="Vent"
          value={`${Math.round(weather.windSpeed)} km/h`}
          sub={windDirectionLabel(weather.windDirection)}
        />
        <WeatherMetric
          icon={<Wind size={16} />}
          label="Rafales"
          value={`${Math.round(weather.windGusts)} km/h`}
        />
        <WeatherMetric
          icon={<Waves size={16} />}
          label="Vagues"
          value={`${weather.waveHeight.toFixed(1)} m`}
        />
        <WeatherMetric
          icon={<Eye size={16} />}
          label="Visibilité"
          value={
            weather.visibility >= 1000
              ? `${(weather.visibility / 1000).toFixed(0)} km`
              : `${Math.round(weather.visibility)} m`
          }
        />
        <WeatherMetric
          icon={<Thermometer size={16} />}
          label="Température"
          value={`${Math.round(weather.temperature)}°C`}
        />
      </div>
    </Card>
  )
}

function WeatherMetric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
      <div className="text-gray-400 dark:text-gray-500">{icon}</div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>
      )}
    </div>
  )
}

// ── Level options for quick update ────────────────────────────────────────

const LEVEL_OPTIONS = ['full', '3/4', 'half', '1/4', 'reserve', 'empty'] as const

// ── LevelsBar ─────────────────────────────────────────────────────────────

function LevelsBar({
  fuelTank,
  jerricans,
  water,
  voyageId,
  onUpdated,
}: {
  fuelTank: string | null
  jerricans: number | null
  water: string | null
  voyageId: string
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localFuel, setLocalFuel] = useState(fuelTank ?? 'half')
  const [localWater, setLocalWater] = useState(water ?? 'half')

  useEffect(() => {
    setLocalFuel(fuelTank ?? 'half')
    setLocalWater(water ?? 'half')
  }, [fuelTank, water])

  const fuelPercent = LEVEL_VALUES[fuelTank ?? ''] ?? 0
  const waterPercent = LEVEL_VALUES[water ?? ''] ?? 0

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase
        .from('boat_status')
        .update({ fuel_tank: localFuel, water: localWater })
        .eq('voyage_id', voyageId)
      setEditing(false)
      onUpdated()
    } catch (err) {
      console.error('Failed to update levels:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Niveaux
        </h3>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="text-xs font-medium text-blue-600 active:text-blue-700 dark:text-blue-400"
        >
          {editing ? 'Annuler' : 'Modifier'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-4">
          <QuickLevelSelector
            icon={<Fuel size={16} />}
            label="Carburant"
            value={localFuel}
            onChange={setLocalFuel}
          />
          <QuickLevelSelector
            icon={<Droplets size={16} />}
            label="Eau douce"
            value={localWater}
            onChange={setLocalWater}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white active:bg-blue-700 disabled:opacity-50 dark:bg-blue-500"
          >
            {saving ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            Enregistrer
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <LevelRow
              icon={<Fuel size={16} />}
              label="Carburant"
              percent={fuelPercent}
              displayValue={LEVEL_LABELS[fuelTank ?? ''] ?? '—'}
              extra={
                jerricans !== null && jerricans > 0
                  ? `+ ${jerricans} jerricans`
                  : undefined
              }
            />
            <LevelRow
              icon={<Droplets size={16} />}
              label="Eau douce"
              percent={waterPercent}
              displayValue={LEVEL_LABELS[water ?? ''] ?? '—'}
            />
          </div>
        </>
      )}
    </Card>
  )
}

function QuickLevelSelector({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <div className="text-gray-400 dark:text-gray-500">{icon}</div>
        {label}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {LEVEL_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-md px-1 py-2 text-xs font-medium transition-colors ${
              value === opt
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-100 text-gray-600 active:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:active:bg-gray-700'
            }`}
          >
            {LEVEL_LABELS[opt]}
          </button>
        ))}
      </div>
    </div>
  )
}

function LevelRow({
  icon,
  label,
  percent,
  displayValue,
  extra,
}: {
  icon: React.ReactNode
  label: string
  percent: number
  displayValue: string
  extra?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-gray-400 dark:text-gray-500">{icon}</div>
      <div className="flex-1">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {displayValue}
            {extra && (
              <span className="ml-1 text-gray-400 dark:text-gray-500">
                {extra}
              </span>
            )}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${getLevelColor(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ── RouteProgress ─────────────────────────────────────────────────────────

function RouteProgress({
  steps,
  loading,
}: {
  steps: RouteStepRow[]
  loading: boolean
}) {
  const router = useRouter()

  if (loading) {
    return <Skeleton className="h-[100px]" />
  }

  if (steps.length === 0) {
    return (
      <Card onClick={() => router.push('/route')}>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Aucun itinéraire défini
        </p>
      </Card>
    )
  }

  const doneCount = steps.filter((s) => s.status === 'done').length
  const currentStep = steps.find((s) => s.status === 'in_progress') ?? null
  const totalSteps = steps.length
  const progressPercent =
    totalSteps > 0 ? Math.round((doneCount / totalSteps) * 100) : 0

  const remainingNm = steps
    .filter((s) => s.status === 'to_do' || s.status === 'in_progress')
    .reduce((sum, s) => sum + (s.distance_nm ?? 0), 0)

  const remainingKm = steps
    .filter((s) => s.status === 'to_do' || s.status === 'in_progress')
    .reduce((sum, s) => sum + (s.distance_km ?? 0), 0)

  return (
    <Card onClick={() => router.push('/route')}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Itinéraire
      </h3>
      {currentStep && (
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <Anchor size={14} className="text-blue-500" />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {currentStep.name}
            </p>
          </div>
          {currentStep.phase && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Phase : {currentStep.phase}
            </p>
          )}
        </div>
      )}
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Étape {doneCount + (currentStep ? 1 : 0)}/{totalSteps}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {remainingNm > 0 && `${Math.round(remainingNm)} NM`}
          {remainingNm > 0 && remainingKm > 0 && ' + '}
          {remainingKm > 0 && `${Math.round(remainingKm)} km`}
          {remainingNm === 0 && remainingKm === 0 && 'Terminé'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </Card>
  )
}

// ── Pull-to-refresh hook ──────────────────────────────────────────────────

function usePullToRefresh(onRefresh: () => Promise<void>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef(0)
  const pulling = useRef(false)

  const THRESHOLD = 80

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0 && !refreshing) {
        startY.current = e.touches[0].clientY
        pulling.current = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > 0) {
        setPullDistance(Math.min(delta * 0.5, THRESHOLD * 1.5))
      }
    }

    const onTouchEnd = async () => {
      if (!pulling.current) return
      pulling.current = false

      if (pullDistance >= THRESHOLD) {
        setRefreshing(true)
        setPullDistance(THRESHOLD * 0.5)
        try {
          await onRefresh()
        } finally {
          setRefreshing(false)
        }
      }
      setPullDistance(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onRefresh, pullDistance, refreshing])

  return { containerRef, pullDistance, refreshing }
}

// ── Dashboard Page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const { voyage, boatStatus, loading, refresh } = useActiveVoyage()
  const { containerRef, pullDistance, refreshing } = usePullToRefresh(refresh)

  const [briefing, setBriefing] = useState<BriefingRow | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(true)
  const [routeSteps, setRouteSteps] = useState<RouteStepRow[]>([])
  const [routeLoading, setRouteLoading] = useState(true)
  const [latestLog, setLatestLog] = useState<LogRow | null>(null)
  const [pendingReminders, setPendingReminders] = useState<ReminderRow[]>([])

  // Fetch data when voyage changes (use ID to avoid re-runs on object ref changes)
  const voyageId = voyage?.id ?? null
  useEffect(() => {
    if (!voyageId) {
      setBriefingLoading(false)
      setRouteLoading(false)
      return
    }

    const supabase = createClient()

    // Fetch briefing
    const fetchBriefing = async () => {
      const { data, error } = await supabase
        .from('briefings')
        .select('*')
        .eq('voyage_id', voyageId)
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<BriefingRow[]>()
        .maybeSingle()

      if (error) {
        console.error('Failed to fetch briefing:', error.message)
      } else {
        setBriefing(data)
      }
      setBriefingLoading(false)
    }

    // Fetch route steps
    const fetchSteps = async () => {
      const { data, error } = await supabase
        .from('route_steps')
        .select('*')
        .eq('voyage_id', voyageId)
        .order('order_num', { ascending: true })
        .returns<RouteStepRow[]>()

      if (error) {
        console.error('Failed to fetch route steps:', error.message)
      } else {
        setRouteSteps(data ?? [])
      }
      setRouteLoading(false)
    }

    // Fetch latest log
    const fetchLatestLog = async () => {
      const { data } = await supabase
        .from('logs')
        .select('*')
        .eq('voyage_id', voyageId)
        .order('created_at', { ascending: false })
        .limit(1)
        .returns<LogRow[]>()
        .maybeSingle()

      setLatestLog(data ?? null)
    }

    // Fetch pending reminders
    const fetchReminders = async () => {
      const { data } = await supabase
        .from('reminders')
        .select('*')
        .eq('voyage_id', voyageId)
        .eq('status', 'pending')
        .lte('remind_at', new Date().toISOString())
        .returns<ReminderRow[]>()

      setPendingReminders(data ?? [])
    }

    fetchBriefing()
    fetchSteps()
    fetchLatestLog()
    fetchReminders()
  }, [voyageId])

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[80px]" />
        <Skeleton className="h-[100px]" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (!user) return null

  if (!voyage) {
    return (
      <div className="p-4">
        <Card className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
          <Anchor size={40} className="text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">
            Aucune navigation active
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Créez une navigation dans les paramètres pour commencer
          </p>
        </Card>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const hasBriefingToday = briefing
    ? briefing.created_at.slice(0, 10) === today
    : false

  return (
    <div ref={containerRef} className="relative">
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-[height]"
          style={{ height: refreshing ? 40 : pullDistance > 0 ? pullDistance : 0 }}
        >
          <RefreshCw
            size={20}
            className={`text-blue-500 ${refreshing ? 'animate-spin' : ''}`}
            style={{
              opacity: Math.min(pullDistance / 80, 1),
              transform: `rotate(${pullDistance * 3}deg)`,
            }}
          />
        </div>
      )}

      <div className="space-y-3 p-4">
        <header className="mb-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {voyage.name}
          </h1>
          {boatStatus?.current_position && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <MapPin size={12} className="mr-0.5 inline" />
              {boatStatus.current_position}
              {boatStatus.updated_at && (
                <span className="ml-1.5 text-gray-400 dark:text-gray-600">
                  ({timeAgo(boatStatus.updated_at)})
                </span>
              )}
            </p>
          )}
        </header>

        <PushPermissionBanner />

        <VerdictCard briefing={briefing} loading={briefingLoading} />

        <MateMessages
          latestLog={latestLog}
          fuelTank={boatStatus?.fuel_tank ?? null}
          pendingReminders={pendingReminders}
          hasBriefingToday={hasBriefingToday}
        />

        <WeatherSummary
          lat={boatStatus?.current_lat ?? null}
          lon={boatStatus?.current_lon ?? null}
        />

        <LevelsBar
          fuelTank={boatStatus?.fuel_tank ?? null}
          jerricans={boatStatus?.jerricans ?? null}
          water={boatStatus?.water ?? null}
          voyageId={voyage.id}
          onUpdated={refresh}
        />

        <RouteProgress steps={routeSteps} loading={routeLoading} />

        <Card onClick={() => { window.location.href = '/map' }}>
          <div className="h-40 overflow-hidden rounded-lg">
            <MiniMapDynamic
              routeSteps={routeSteps}
              boatLat={boatStatus?.current_lat ?? null}
              boatLon={boatStatus?.current_lon ?? null}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
