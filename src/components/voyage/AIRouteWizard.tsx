'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────

export interface RouteStep {
  order_num: number
  name: string
  from_port: string
  to_port: string
  distance_nm: number | null
  distance_km: number | null
  phase: string | null
  notes: string | null
  from_lat: number | null
  from_lon: number | null
  to_lat: number | null
  to_lon: number | null
}

export interface RouteOption {
  id: string
  name: string
  summary: string
  distance: string
  estimated_days: string
  pros: string[]
  cons: string[]
  warnings: string[]
  steps: RouteStep[]
}

interface BoatSpec {
  name: string
  type?: string | null
  length_m?: number | null
  draft_m?: number | null
  air_draft_m?: number | null
  engine_type?: string | null
  fuel_capacity_hours?: number | null
  avg_speed_kn?: number | null
}

interface ProfileSpec {
  experience?: string | null
  crew_mode?: string | null
  risk_tolerance?: string | null
  night_sailing?: string | null
  max_continuous_hours?: number | null
}

interface AIRouteWizardProps {
  departurePort: string
  arrivalPort: string
  boat: BoatSpec
  profile: ProfileSpec
  onRouteConfirmed: (route: RouteOption | null) => void
  onLoadingChange?: (loading: boolean) => void
  abortRef?: React.MutableRefObject<AbortController | null>
}

// ── Helpers ────────────────────────────────────────────────────────────

function getPhaseMessage(charCount: number, departure: string, arrival: string): string {
  if (charCount < 500) return `Analyse du trajet ${departure} → ${arrival}...`
  if (charCount < 2000) return 'Calcul des étapes et distances...'
  if (charCount < 5000) return 'Évaluation des passages critiques...'
  if (charCount < 8000) return 'Vérification des contraintes du bateau...'
  return 'Finalisation des itinéraires...'
}

interface DiscoveredRoute {
  name: string
  stepCount: number
  lastStep: string | null
  done: boolean
}

const LAST_STEP_REGEX = /"from_port"\s*:\s*"([^"]+)"\s*,\s*"to_port"\s*:\s*"([^"]+)"/g

function extractDiscoveredRoutes(text: string): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = []
  // Route-level names are always followed by "summary" in the JSON structure.
  // Step-level names are preceded by "order_num", so this regex skips them.
  const routeNameRegex = /"name"\s*:\s*"([^"]+)"\s*,\s*"summary"/g
  let match: RegExpExecArray | null
  const positions: { name: string; pos: number }[] = []

  while ((match = routeNameRegex.exec(text)) !== null) {
    positions.push({ name: match[1], pos: match.index })
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos
    const end = i + 1 < positions.length ? positions[i + 1].pos : text.length
    const section = text.slice(start, end)
    const stepMatches = section.match(/"order_num"/g)

    // Find the last from_port → to_port in this route's section
    let lastStep: string | null = null
    LAST_STEP_REGEX.lastIndex = 0
    let stepMatch: RegExpExecArray | null
    while ((stepMatch = LAST_STEP_REGEX.exec(section)) !== null) {
      lastStep = `${stepMatch[1]} → ${stepMatch[2]}`
    }

    routes.push({
      name: positions[i].name,
      stepCount: stepMatches ? stepMatches.length : 0,
      lastStep,
      // A route is "done" if a next route has started after it
      done: i < positions.length - 1,
    })
  }

  return routes
}

function extractStepsFromSection(section: string): RouteStep[] {
  const steps: RouteStep[] = []
  const fromPortRegex = /"from_port"\s*:\s*"([^"]*)"/g
  const positions: { port: string; pos: number }[] = []
  let m: RegExpExecArray | null
  while ((m = fromPortRegex.exec(section)) !== null) {
    positions.push({ port: m[1], pos: m.index })
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos
    const end = i + 1 < positions.length ? positions[i + 1].pos : section.length
    const slice = section.slice(start, end)

    const toPort = slice.match(/"to_port"\s*:\s*"([^"]*)"/)
    const fromLat = slice.match(/"from_lat"\s*:\s*([-\d.]+)/)
    const fromLon = slice.match(/"from_lon"\s*:\s*([-\d.]+)/)
    const toLat = slice.match(/"to_lat"\s*:\s*([-\d.]+)/)
    const toLon = slice.match(/"to_lon"\s*:\s*([-\d.]+)/)

    if (fromLat && fromLon) {
      steps.push({
        order_num: i + 1,
        name: `${positions[i].port} → ${toPort?.[1] ?? '...'}`,
        from_port: positions[i].port,
        to_port: toPort?.[1] ?? '',
        from_lat: parseFloat(fromLat[1]),
        from_lon: parseFloat(fromLon[1]),
        to_lat: toLat ? parseFloat(toLat[1]) : null,
        to_lon: toLon ? parseFloat(toLon[1]) : null,
        distance_nm: null,
        distance_km: null,
        phase: null,
        notes: null,
      })
    }
  }

  return steps
}

function extractStreamingSteps(text: string): RouteStep[][] {
  const routeBoundary = /"name"\s*:\s*"[^"]+"\s*,\s*"summary"/g
  const routePositions: number[] = []
  let rm: RegExpExecArray | null
  while ((rm = routeBoundary.exec(text)) !== null) {
    routePositions.push(rm.index)
  }
  if (routePositions.length === 0) return []

  const allRoutes: RouteStep[][] = []
  for (let r = 0; r < routePositions.length; r++) {
    const start = routePositions[r]
    const end = r + 1 < routePositions.length ? routePositions[r + 1] : text.length
    const steps = extractStepsFromSection(text.slice(start, end))
    if (steps.length > 0) allRoutes.push(steps)
  }

  return allRoutes
}

// ── Fallback JSON parser (when SSE stream is interrupted) ─────────────

function extractJSONFallback(text: string): RouteOption[] {
  // Try to parse the accumulated AI text as JSON directly
  // Same approach as the server-side extractJSON
  let parsed: { routes?: Array<{
    name: string
    summary: string
    total_distance_nm?: number
    total_distance_km?: number
    estimated_days?: number
    pros?: string[]
    cons?: string[]
    warnings?: string[]
    steps?: Array<{
      order_num: number
      name: string
      from_port: string
      to_port: string
      distance_nm?: number | null
      distance_km?: number | null
      phase?: string
      notes?: string
      from_lat: number
      from_lon: number
      to_lat: number
      to_lon: number
    }>
  }> } | null = null

  try {
    parsed = JSON.parse(text)
  } catch { /* continue */ }

  if (!parsed) {
    const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (jsonBlockMatch?.[1]) {
      try { parsed = JSON.parse(jsonBlockMatch[1]) } catch { /* continue */ }
    }
  }

  if (!parsed) {
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try { parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1)) } catch { /* give up */ }
    }
  }

  if (!parsed?.routes || parsed.routes.length === 0) return []

  return parsed.routes.map((route, index) => ({
    id: `route-${index}`,
    name: route.name,
    summary: route.summary,
    distance: `${route.total_distance_nm ?? 0} NM / ${route.total_distance_km ?? 0} km`,
    estimated_days: `~${route.estimated_days ?? '?'} jours`,
    pros: route.pros || [],
    cons: route.cons || [],
    warnings: route.warnings || [],
    steps: (route.steps || []).map((s) => ({
      order_num: s.order_num,
      name: s.name,
      from_port: s.from_port,
      to_port: s.to_port,
      distance_nm: s.distance_nm ?? null,
      distance_km: s.distance_km ?? null,
      phase: s.phase ?? null,
      notes: s.notes ?? null,
      from_lat: s.from_lat ?? null,
      from_lon: s.from_lon ?? null,
      to_lat: s.to_lat ?? null,
      to_lon: s.to_lon ?? null,
    })),
  }))
}

// ── Dynamic import for Leaflet map (no SSR) ────────────────────────────

const RoutePreviewMap = dynamic(() => import('./RoutePreviewMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  ),
})

// ── Component ──────────────────────────────────────────────────────────

export default function AIRouteWizard({
  departurePort,
  arrivalPort,
  boat,
  profile,
  onRouteConfirmed,
  onLoadingChange,
  abortRef,
}: AIRouteWizardProps) {
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customDescription, setCustomDescription] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // Progressive loading states
  const [streamLength, setStreamLength] = useState(0)
  const [discoveredRoutes, setDiscoveredRoutes] = useState<DiscoveredRoute[]>([])
  const [visibleCount, setVisibleCount] = useState(0)
  const [streamingRoutes, setStreamingRoutes] = useState<RouteStep[][]>([])
  const streamAccumulatorRef = useRef('')
  const streamingStepsCountRef = useRef(0)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Expose abort controller to parent
  useEffect(() => {
    if (abortRef) {
      abortRef.current = abortControllerRef.current
    }
  })

  // Staggered reveal of route cards when routeOptions arrive
  useEffect(() => {
    if (routeOptions.length === 0) {
      setVisibleCount(0)
      return
    }
    // Stagger each card appearance by 300ms
    let count = 0
    const interval = setInterval(() => {
      count++
      setVisibleCount(count)
      if (count >= routeOptions.length) {
        clearInterval(interval)
      }
    }, 300)
    return () => clearInterval(interval)
  }, [routeOptions])

  const setLoading = useCallback((loading: boolean) => {
    setLoadingRoutes(loading)
    onLoadingChange?.(loading)
  }, [onLoadingChange])

  const generateRoutes = async (customText?: string) => {
    // Abort any previous request
    abortControllerRef.current?.abort()

    const controller = new AbortController()
    abortControllerRef.current = controller
    if (abortRef) abortRef.current = controller

    // 5 min timeout for complex route generation
    const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000)

    setLoading(true)
    setRouteError(null)
    setRouteOptions([])
    setSelectedRoute(null)
    setConfirmed(false)
    setStreamLength(0)
    setDiscoveredRoutes([])
    setStreamingRoutes([])
    streamAccumulatorRef.current = ''
    streamingStepsCountRef.current = 0

    // Request Wake Lock to prevent screen sleep during generation
    let wakeLock: WakeLockSentinel | null = null
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen')
      }
    } catch { /* Wake Lock not available or denied — continue without it */ }

    try {
      const res = await fetch('/api/ai/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          departure_port: departurePort,
          arrival_port: arrivalPort,
          custom_description: customText || undefined,
          boat: {
            name: boat.name,
            type: boat.type,
            length_m: boat.length_m,
            draft_m: boat.draft_m,
            air_draft_m: boat.air_draft_m,
            engine_type: boat.engine_type,
            fuel_capacity_hours: boat.fuel_capacity_hours,
            avg_speed_kn: boat.avg_speed_kn,
          },
          profile: {
            experience: profile.experience,
            crew_mode: profile.crew_mode,
            risk_tolerance: profile.risk_tolerance,
            night_sailing: profile.night_sailing,
            max_continuous_hours: profile.max_continuous_hours,
          },
        }),
      })

      // Detect auth redirect (307 → /login page returns HTML, not SSE)
      if (res.redirected || res.headers.get('content-type')?.includes('text/html')) {
        throw new Error('Session expirée. Veuillez vous reconnecter.')
      }

      if (!res.ok) {
        // Try to extract server error message
        try {
          const errBody = await res.json()
          throw new Error(errBody.error || `Erreur serveur (${res.status})`)
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
          throw new Error(`Erreur serveur (${res.status})`)
        }
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Pas de stream disponible')

      const decoder = new TextDecoder()
      let buffer = ''
      let receivedDone = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'text_delta') {
              // Accumulate in ref (not state) for performance
              streamAccumulatorRef.current += event.text
              const len = streamAccumulatorRef.current.length
              setStreamLength(len)
              // Extract discovered routes progressively
              const routes = extractDiscoveredRoutes(streamAccumulatorRef.current)
              if (routes.length > 0) {
                setDiscoveredRoutes(routes)
              }
              // Extract step coordinates for progressive map drawing
              const newRoutes = extractStreamingSteps(streamAccumulatorRef.current)
              const totalSteps = newRoutes.reduce((sum, r) => sum + r.length, 0)
              if (totalSteps > streamingStepsCountRef.current) {
                streamingStepsCountRef.current = totalSteps
                setStreamingRoutes(newRoutes)
              }
            } else if (event.type === 'done') {
              receivedDone = true
              setRouteOptions(event.options || [])
            } else if (event.type === 'error') {
              throw new Error(event.error)
            }
          } catch (parseErr) {
            // If it's a rethrown error from event.type === 'error', propagate
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr
            }
          }
        }
      }

      // Fallback: stream ended without receiving the 'done' event
      // (e.g. connection dropped after screen wake, network hiccup)
      // Try to parse accumulated text directly
      if (!receivedDone && streamAccumulatorRef.current.length > 1000) {
        try {
          const fallbackParsed = extractJSONFallback(streamAccumulatorRef.current)
          if (fallbackParsed.length > 0) {
            setRouteOptions(fallbackParsed)
            return // Success via fallback
          }
        } catch { /* fallback parsing failed */ }
        throw new Error(
          'La connexion a été interrompue pendant la génération. Gardez l\'écran allumé et réessayez.'
        )
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was cancelled (e.g. user clicked "Passer" or timeout)
        if (!abortControllerRef.current) {
          // Timeout — controller was already cleared
          setRouteError(
            'La génération a pris trop de temps. Réessayez ou simplifiez le trajet.'
          )
        }
        return
      }
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setRouteError(msg)
    } finally {
      clearTimeout(timeout)
      wakeLock?.release().catch(() => {})
      setLoading(false)
      streamAccumulatorRef.current = ''
      abortControllerRef.current = null
      if (abortRef) abortRef.current = null
    }
  }

  const canGenerate = departurePort.trim() && arrivalPort.trim()

  const selectedRouteData = selectedRoute
    ? routeOptions.find((o) => o.id === selectedRoute) ?? null
    : null

  const isStreaming = loadingRoutes && routeOptions.length === 0
  const totalStreamingSteps = streamingRoutes.reduce((sum, r) => sum + r.length, 0)

  return (
    <div className="space-y-3">
      {/* Generate button */}
      {!loadingRoutes && routeOptions.length === 0 && !confirmed && streamLength === 0 && (
        <button
          type="button"
          disabled={!canGenerate || loadingRoutes}
          onClick={() => generateRoutes()}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-700"
        >
          <Sparkles className="h-5 w-5" />
          Générer les itinéraires
        </button>
      )}

      {/* Loading: Map with progressive route drawing + route names */}
      {isStreaming && (
        <div className="space-y-3">
          <RoutePreviewMap
            steps={streamingRoutes[0] ?? []}
            additionalRoutes={streamingRoutes.slice(1)}
            overlay={
              totalStreamingSteps === 0 ? (
                <div className="flex h-full flex-col items-center justify-center bg-slate-900/60 backdrop-blur-[2px]">
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-400" />
                  <p className="text-sm font-medium text-white">
                    {getPhaseMessage(streamLength, departurePort, arrivalPort)}
                  </p>
                </div>
              ) : (
                <div className="pointer-events-none flex h-full items-end justify-center pb-2">
                  <div className="flex items-center gap-2 rounded-full bg-slate-900/75 px-3 py-1.5 backdrop-blur-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                    <span className="text-xs font-medium text-white">
                      {totalStreamingSteps} étape{totalStreamingSteps > 1 ? 's' : ''} — {getPhaseMessage(streamLength, departurePort, arrivalPort)}
                    </span>
                  </div>
                </div>
              )
            }
          />

          {/* Discovered route cards */}
          {discoveredRoutes.length > 0 && (
            <div className="space-y-2">
              {discoveredRoutes.map((route, i) => (
                <div
                  key={route.name}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 transition-all duration-300 dark:border-slate-700 dark:bg-slate-800/80"
                >
                  {route.done ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {route.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {route.stepCount > 0
                        ? `${route.stepCount} étape${route.stepCount > 1 ? 's' : ''}${route.done ? '' : route.lastStep ? ` — ${route.lastStep}...` : '...'}`
                        : 'Analyse en cours...'}
                    </p>
                  </div>
                </div>
              ))}
              {/* Pending placeholder for next route */}
              <div
                className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600"
              >
                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                <span className="text-sm text-slate-400 dark:text-slate-500">
                  Option {discoveredRoutes.length + 1}...
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {routeError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            {routeError}
          </p>
          <button
            type="button"
            onClick={() => generateRoutes()}
            className="mt-2 min-h-[44px] text-sm font-medium text-red-700 underline dark:text-red-400"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Route options with staggered animation */}
      {routeOptions.length > 0 && !confirmed && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Choisissez un itinéraire :
          </p>

          {routeOptions.map((option, index) => (
            <div
              key={option.id}
              className="transition-all duration-500 ease-out"
              style={{
                opacity: index < visibleCount ? 1 : 0,
                transform: index < visibleCount ? 'translateY(0)' : 'translateY(12px)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedRoute(option.id)
                  setShowCustom(false)
                }}
                className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                  selectedRoute === option.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {option.name}
                  </h3>
                  <div
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      selectedRoute === option.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {selectedRoute === option.id && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                  {option.summary}
                </p>
                <div className="mb-3 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>{option.distance}</span>
                  <span>{option.estimated_days}</span>
                </div>

                {option.pros.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {option.pros.map((pro, i) => (
                      <p key={i} className="text-xs text-green-700 dark:text-green-400">
                        + {pro}
                      </p>
                    ))}
                  </div>
                )}

                {option.cons.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {option.cons.map((con, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400">
                        - {con}
                      </p>
                    ))}
                  </div>
                )}

                {option.warnings.length > 0 && (
                  <div className="space-y-1">
                    {option.warnings.map((warning, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {warning}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            </div>
          ))}

          {/* Custom "Autre" option */}
          <div
            className="transition-all duration-500 ease-out"
            style={{
              opacity: visibleCount >= routeOptions.length ? 1 : 0,
              transform: visibleCount >= routeOptions.length ? 'translateY(0)' : 'translateY(12px)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedRoute(null)
                setShowCustom(true)
              }}
              className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                showCustom
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Autre
                </span>
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    showCustom
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {showCustom && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Décrivez votre itinéraire préféré
              </p>
            </button>
          </div>

          {/* Custom text area */}
          {showCustom && (
            <div className="space-y-3">
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="ex: Je veux passer par le canal du Midi mais m'arrêter à Bordeaux 3 jours..."
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
              />
              <button
                type="button"
                disabled={!customDescription.trim() || loadingRoutes}
                onClick={() => generateRoutes(customDescription)}
                className="flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                <Sparkles className="h-4 w-4" />
                Générer un itinéraire personnalisé
              </button>
            </div>
          )}

          {/* Map preview with Leaflet */}
          {selectedRouteData && selectedRouteData.steps.length > 0 && (
            <RoutePreviewMap steps={selectedRouteData.steps} />
          )}

          {/* Confirm button */}
          {selectedRoute && (
            <button
              type="button"
              onClick={() => {
                setConfirmed(true)
                const route = routeOptions.find((o) => o.id === selectedRoute) ?? null
                onRouteConfirmed(route)
              }}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-base font-semibold text-white transition-colors hover:bg-green-700 active:bg-green-800"
            >
              <CheckCircle className="h-5 w-5" />
              Valider l&apos;itinéraire
            </button>
          )}
        </div>
      )}

      {/* Confirmed state */}
      {confirmed && selectedRoute && (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-400">
              Itinéraire validé :{' '}
              <span className="font-semibold">
                {routeOptions.find((o) => o.id === selectedRoute)?.name}
              </span>
            </p>
          </div>
          {selectedRouteData && selectedRouteData.steps.length > 0 && (
            <RoutePreviewMap steps={selectedRouteData.steps} />
          )}
        </>
      )}
    </div>
  )
}
