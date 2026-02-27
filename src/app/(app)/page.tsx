'use client'

import { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Database } from '@/lib/supabase/types'

type BriefingRow = Database['public']['Tables']['briefings']['Row']
type RouteStepRow = Database['public']['Tables']['route_steps']['Row']

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

// ── VerdictCard ───────────────────────────────────────────────────────────

function VerdictCard({ voyageId }: { voyageId: string }) {
  const router = useRouter()
  const [briefing, setBriefing] = useState<BriefingRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBriefing = async () => {
      const supabase = createClient()
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
      setLoading(false)
    }

    fetchBriefing()
  }, [voyageId])

  if (loading) {
    return (
      <Card className="flex min-h-[120px] items-center justify-center">
        <LoadingSpinner size="sm" />
      </Card>
    )
  }

  if (!briefing || !briefing.verdict) {
    return (
      <Card
        className="flex min-h-[120px] flex-col items-center justify-center gap-2"
        onClick={() => router.push('/briefings')}
      >
        <p className="text-lg font-semibold text-gray-400 dark:text-gray-500">
          Aucun briefing disponible
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-600">
          Le premier briefing sera disponible demain matin
        </p>
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
    return (
      <Card className="flex min-h-[80px] items-center justify-center">
        <LoadingSpinner size="sm" />
      </Card>
    )
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

// ── LevelsBar ─────────────────────────────────────────────────────────────

function LevelsBar({
  fuelTank,
  jerricans,
  water,
}: {
  fuelTank: string | null
  jerricans: number | null
  water: string | null
}) {
  const router = useRouter()

  const fuelPercent = LEVEL_VALUES[fuelTank ?? ''] ?? 0
  const waterPercent = LEVEL_VALUES[water ?? ''] ?? 0

  return (
    <Card onClick={() => router.push('/log')}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Niveaux
      </h3>
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
      <p className="mt-2 text-right text-[10px] text-gray-400 dark:text-gray-500">
        Mettre à jour dans le journal <ChevronRight size={10} className="inline" />
      </p>
    </Card>
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

function RouteProgress({ voyageId }: { voyageId: string }) {
  const router = useRouter()
  const [steps, setSteps] = useState<RouteStepRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSteps = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('route_steps')
        .select('*')
        .eq('voyage_id', voyageId)
        .order('order_num', { ascending: true })
        .returns<RouteStepRow[]>()

      if (error) {
        console.error('Failed to fetch route steps:', error.message)
      } else {
        setSteps(data ?? [])
      }
      setLoading(false)
    }

    fetchSteps()
  }, [voyageId])

  if (loading) {
    return (
      <Card className="flex min-h-[80px] items-center justify-center">
        <LoadingSpinner size="sm" />
      </Card>
    )
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

// ── MiniMap ───────────────────────────────────────────────────────────────

function MiniMap() {
  const router = useRouter()

  return (
    <Card onClick={() => router.push('/map')}>
      <div className="flex h-32 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
        <div className="flex flex-col items-center gap-1 text-blue-400 dark:text-blue-500">
          <MapPin size={24} />
          <span className="text-sm font-medium">Voir la carte</span>
        </div>
      </div>
    </Card>
  )
}

// ── Dashboard Page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const { voyage, boatStatus, loading } = useActiveVoyage()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner text="Chargement du tableau de bord..." />
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

  return (
    <div className="space-y-3 p-4">
      <header className="mb-1">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {voyage.name}
        </h1>
        {boatStatus?.current_position && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <MapPin size={12} className="mr-0.5 inline" />
            {boatStatus.current_position}
          </p>
        )}
      </header>

      <VerdictCard voyageId={voyage.id} />

      <WeatherSummary
        lat={boatStatus?.current_lat ?? null}
        lon={boatStatus?.current_lon ?? null}
      />

      <LevelsBar
        fuelTank={boatStatus?.fuel_tank ?? null}
        jerricans={boatStatus?.jerricans ?? null}
        water={boatStatus?.water ?? null}
      />

      <RouteProgress voyageId={voyage.id} />

      <MiniMap />
    </div>
  )
}
