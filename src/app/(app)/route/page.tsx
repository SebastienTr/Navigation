'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Route,
  CheckCircle2,
  Circle,
  Square,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPinOff,
} from 'lucide-react'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Database } from '@/lib/supabase/types'

type RouteStepRow = Database['public']['Tables']['route_steps']['Row']
type StepStatus = RouteStepRow['status']

// ── Types ────────────────────────────────────────────────────────────────────

interface PhaseGroup {
  phase: string
  steps: RouteStepRow[]
  doneCount: number
  totalCount: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupStepsByPhase(steps: RouteStepRow[]): PhaseGroup[] {
  const phaseMap = new Map<string, RouteStepRow[]>()
  const phaseOrder: string[] = []

  for (const step of steps) {
    const phaseName = step.phase ?? 'Sans phase'
    if (!phaseMap.has(phaseName)) {
      phaseMap.set(phaseName, [])
      phaseOrder.push(phaseName)
    }
    phaseMap.get(phaseName)!.push(step)
  }

  return phaseOrder.map((phase) => {
    const phaseSteps = phaseMap.get(phase)!
    return {
      phase,
      steps: phaseSteps,
      doneCount: phaseSteps.filter((s) => s.status === 'done').length,
      totalCount: phaseSteps.length,
    }
  })
}

function nextStatus(current: StepStatus): StepStatus {
  switch (current) {
    case 'to_do':
      return 'in_progress'
    case 'in_progress':
      return 'done'
    case 'done':
      return 'to_do'
  }
}

function statusLabel(status: StepStatus): string {
  switch (status) {
    case 'done':
      return 'Terminé'
    case 'in_progress':
      return 'En cours'
    case 'to_do':
      return 'À faire'
  }
}

function formatDistance(step: RouteStepRow): string {
  if (step.distance_nm != null && step.distance_nm > 0) {
    return `${step.distance_nm} NM`
  }
  if (step.distance_km != null && step.distance_km > 0) {
    return `${step.distance_km} km`
  }
  return ''
}

// ── StatusIcon component ─────────────────────────────────────────────────────

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
    case 'in_progress':
      return <Circle className="h-5 w-5 shrink-0 fill-blue-500 text-blue-500" />
    case 'to_do':
      return <Square className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoutePage() {
  const { voyage, boatStatus, loading: voyageLoading } = useActiveVoyage()

  const [steps, setSteps] = useState<RouteStepRow[]>([])
  const [stepsLoading, setStepsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())

  // Fetch route steps
  const fetchSteps = useCallback(async () => {
    if (!voyage) {
      setSteps([])
      setStepsLoading(false)
      return
    }

    setStepsLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('route_steps')
      .select('*')
      .eq('voyage_id', voyage.id)
      .order('order_num', { ascending: true })
      .returns<RouteStepRow[]>()

    if (error) {
      console.error('Failed to fetch route steps:', error.message)
    } else {
      setSteps(data ?? [])
    }
    setStepsLoading(false)
  }, [voyage])

  useEffect(() => {
    fetchSteps()
  }, [fetchSteps])

  // Toggle step status
  const handleToggleStatus = async (step: RouteStepRow) => {
    if (!voyage) return

    const newStatus = nextStatus(step.status)
    setUpdatingId(step.id)

    // Optimistic update
    setSteps((prev) =>
      prev.map((s) => (s.id === step.id ? { ...s, status: newStatus } : s))
    )

    const supabase = createClient()

    const { error: stepError } = await supabase
      .from('route_steps')
      .update({ status: newStatus })
      .eq('id', step.id)

    if (stepError) {
      console.error('Failed to update step status:', stepError.message)
      // Revert optimistic update
      setSteps((prev) =>
        prev.map((s) => (s.id === step.id ? { ...s, status: step.status } : s))
      )
      setUpdatingId(null)
      return
    }

    // Update boat_status current_step_id if step is now in_progress
    if (newStatus === 'in_progress') {
      const { error: statusError } = await supabase
        .from('boat_status')
        .update({
          current_step_id: step.id,
          current_phase: step.phase,
          updated_at: new Date().toISOString(),
        })
        .eq('voyage_id', voyage.id)

      if (statusError) {
        console.error('Failed to update boat status:', statusError.message)
      }
    }

    setUpdatingId(null)
  }

  // Toggle phase collapse
  const togglePhase = (phase: string) => {
    setCollapsedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phase)) {
        next.delete(phase)
      } else {
        next.add(phase)
      }
      return next
    })
  }

  if (voyageLoading || stepsLoading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <LoadingSpinner text="Chargement..." size="lg" />
      </div>
    )
  }

  if (!voyage) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6">
        <MapPinOff className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="text-center text-gray-500 dark:text-gray-400">
          Aucun voyage actif. Créez-en un depuis les Paramètres.
        </p>
      </div>
    )
  }

  if (steps.length === 0) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-6">
        <Route className="h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="text-center text-gray-500 dark:text-gray-400">
          Aucun itinéraire défini. Ajoutez-en un depuis les Paramètres.
        </p>
      </div>
    )
  }

  const phases = groupStepsByPhase(steps)
  const totalSteps = steps.length
  const doneSteps = steps.filter((s) => s.status === 'done').length
  const progressPercent = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0

  const totalNm = steps.reduce((sum, s) => sum + (s.distance_nm ?? 0), 0)
  const doneNm = steps
    .filter((s) => s.status === 'done')
    .reduce((sum, s) => sum + (s.distance_nm ?? 0), 0)

  const totalKm = steps.reduce((sum, s) => sum + (s.distance_km ?? 0), 0)
  const doneKm = steps
    .filter((s) => s.status === 'done')
    .reduce((sum, s) => sum + (s.distance_km ?? 0), 0)

  const currentPhase = boatStatus?.current_phase ?? phases.find((p) =>
    p.steps.some((s) => s.status === 'in_progress')
  )?.phase ?? null

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      {/* Header */}
      <div className="mb-5">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">
          {voyage.name}
        </h1>

        {/* Overall progress */}
        <div className="mb-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Progression globale</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {progressPercent}%
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {phases.map((group) => {
          const isCollapsed = collapsedPhases.has(group.phase)
          const phasePercent =
            group.totalCount > 0
              ? Math.round((group.doneCount / group.totalCount) * 100)
              : 0

          return (
            <section
              key={group.phase}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
            >
              {/* Phase header */}
              <button
                type="button"
                onClick={() => togglePhase(group.phase)}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-gray-50 dark:active:bg-gray-800"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {group.phase}
                    </h2>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {group.doneCount}/{group.totalCount}
                    </span>
                  </div>
                  {/* Phase sub-progress */}
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-500"
                      style={{ width: `${phasePercent}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Steps list */}
              {!isCollapsed && (
                <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                  {group.steps.map((step) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(step)}
                        disabled={updatingId === step.id}
                        className="flex min-h-[52px] w-full items-start gap-3 px-4 py-3 text-left transition-colors active:bg-gray-50 disabled:opacity-60 dark:active:bg-gray-800"
                      >
                        {/* Status icon */}
                        <div className="mt-0.5">
                          {updatingId === step.id ? (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                          ) : (
                            <StatusIcon status={step.status} />
                          )}
                        </div>

                        {/* Step content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm font-medium ${
                                step.status === 'done'
                                  ? 'text-gray-400 line-through dark:text-gray-500'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {step.from_port} → {step.to_port}
                            </p>
                            {formatDistance(step) && (
                              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                {formatDistance(step)}
                              </span>
                            )}
                          </div>

                          {/* Status label */}
                          <span
                            className={`mt-0.5 text-xs ${
                              step.status === 'done'
                                ? 'text-green-600 dark:text-green-400'
                                : step.status === 'in_progress'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {statusLabel(step.status)}
                          </span>

                          {/* Notes */}
                          {step.notes && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                              {step.notes}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {/* Stats footer */}
      <footer className="mt-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Résumé
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Distance NM */}
          {totalNm > 0 && (
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {doneNm.toFixed(0)}{' '}
                <span className="text-sm font-normal text-gray-400">/ {totalNm.toFixed(0)} NM</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Distance maritime</p>
            </div>
          )}

          {/* Distance km */}
          {totalKm > 0 && (
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {doneKm.toFixed(0)}{' '}
                <span className="text-sm font-normal text-gray-400">/ {totalKm.toFixed(0)} km</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Distance canaux</p>
            </div>
          )}

          {/* Legs completed */}
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {doneSteps}{' '}
              <span className="text-sm font-normal text-gray-400">/ {totalSteps}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Étapes terminées</p>
          </div>

          {/* Current phase */}
          {currentPhase && (
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {currentPhase}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Phase actuelle</p>
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}
