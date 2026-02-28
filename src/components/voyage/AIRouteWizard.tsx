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

// ── Dynamic import for Leaflet map (no SSR) ────────────────────────────

const RoutePreviewMap = dynamic(() => import('./RoutePreviewMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
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
  const [streamingText, setStreamingText] = useState('')

  const abortControllerRef = useRef<AbortController | null>(null)
  const streamBoxRef = useRef<HTMLPreElement>(null)

  // Expose abort controller to parent
  useEffect(() => {
    if (abortRef) {
      abortRef.current = abortControllerRef.current
    }
  })

  // Auto-scroll the streaming text box
  useEffect(() => {
    if (streamBoxRef.current) {
      streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight
    }
  }, [streamingText])

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

    setLoading(true)
    setRouteError(null)
    setRouteOptions([])
    setSelectedRoute(null)
    setConfirmed(false)
    setStreamingText('')

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

      if (!res.ok) {
        throw new Error('Erreur lors de la génération des routes')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Pas de stream disponible')

      const decoder = new TextDecoder()
      let buffer = ''

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
              setStreamingText((prev) => prev + event.text)
            } else if (event.type === 'done') {
              setRouteOptions(event.options || [])
              setStreamingText('')
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was cancelled (e.g. user clicked "Passer")
        return
      }
      setRouteError(
        'Impossible de générer les itinéraires. Vérifiez votre connexion et réessayez.'
      )
    } finally {
      setLoading(false)
      abortControllerRef.current = null
      if (abortRef) abortRef.current = null
    }
  }

  const canGenerate = departurePort.trim() && arrivalPort.trim()

  const selectedRouteData = selectedRoute
    ? routeOptions.find((o) => o.id === selectedRoute) ?? null
    : null

  return (
    <div className="space-y-3">
      {/* Generate button */}
      {!loadingRoutes && routeOptions.length === 0 && !confirmed && !streamingText && (
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

      {/* Streaming text display */}
      {(loadingRoutes || streamingText) && routeOptions.length === 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>L&apos;IA génère les itinéraires...</span>
          </div>
          <pre
            ref={streamBoxRef}
            className="max-h-64 overflow-y-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-green-400 font-mono whitespace-pre-wrap break-words"
          >
            {streamingText || '...'}
          </pre>
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

      {/* Route options */}
      {routeOptions.length > 0 && !confirmed && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Choisissez un itinéraire :
          </p>

          {routeOptions.map((option) => (
            <button
              key={option.id}
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
          ))}

          {/* Custom "Autre" option */}
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
