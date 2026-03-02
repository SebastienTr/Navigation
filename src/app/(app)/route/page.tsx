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
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Save,
} from 'lucide-react'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
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

interface StepFormData {
  name: string
  from_port: string
  to_port: string
  phase: string
  distance_nm: string
  distance_km: string
  notes: string
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

function emptyFormData(): StepFormData {
  return { name: '', from_port: '', to_port: '', phase: '', distance_nm: '', distance_km: '', notes: '' }
}

function stepToFormData(step: RouteStepRow): StepFormData {
  return {
    name: step.name,
    from_port: step.from_port,
    to_port: step.to_port,
    phase: step.phase ?? '',
    distance_nm: step.distance_nm != null ? String(step.distance_nm) : '',
    distance_km: step.distance_km != null ? String(step.distance_km) : '',
    notes: step.notes ?? '',
  }
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500'

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

// ── Step Edit Form ───────────────────────────────────────────────────────────

function StepEditForm({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  title,
}: {
  data: StepFormData
  onChange: (data: StepFormData) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  title: string
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Départ</label>
          <input
            type="text"
            className={inputClass}
            value={data.from_port}
            onChange={(e) => onChange({ ...data, from_port: e.target.value })}
            placeholder="Port de départ"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Arrivée</label>
          <input
            type="text"
            className={inputClass}
            value={data.to_port}
            onChange={(e) => onChange({ ...data, to_port: e.target.value })}
            placeholder="Port d'arrivée"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Phase</label>
          <select
            className={inputClass}
            value={data.phase}
            onChange={(e) => onChange({ ...data, phase: e.target.value })}
          >
            <option value="">--</option>
            <option value="Maritime">Maritime</option>
            <option value="Canal">Canal</option>
            <option value="Fluvial">Fluvial</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Distance</label>
          <div className="flex gap-2">
            <input
              type="number"
              className={inputClass}
              value={data.distance_nm}
              onChange={(e) => onChange({ ...data, distance_nm: e.target.value })}
              placeholder="NM"
            />
            <input
              type="number"
              className={inputClass}
              value={data.distance_km}
              onChange={(e) => onChange({ ...data, distance_km: e.target.value })}
              placeholder="km"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Notes</label>
        <input
          type="text"
          className={inputClass}
          value={data.notes}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          placeholder="Notes optionnelles"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !data.from_port.trim() || !data.to_port.trim()}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-medium text-white active:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 active:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:active:bg-gray-800"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── Bottom Sheet ─────────────────────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Sheet */}
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-5 pb-8 shadow-xl dark:bg-gray-900">
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
        {children}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoutePage() {
  const { voyage, boat, boatStatus, loading: voyageLoading } = useActiveVoyage()

  const [steps, setSteps] = useState<RouteStepRow[]>([])
  const [stepsLoading, setStepsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set())

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [selectedStep, setSelectedStep] = useState<RouteStepRow | null>(null)
  const [sheetMode, setSheetMode] = useState<'actions' | 'edit' | 'add' | 'delete'  | null>(null)
  const [formData, setFormData] = useState<StepFormData>(emptyFormData())
  const [saving, setSaving] = useState(false)
  const [insertAfterStep, setInsertAfterStep] = useState<RouteStepRow | null>(null)

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

  // Close sheet helper
  const closeSheet = () => {
    setSelectedStep(null)
    setSheetMode(null)
    setFormData(emptyFormData())
    setInsertAfterStep(null)
  }

  // Toggle step status (normal mode)
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
      setSteps((prev) =>
        prev.map((s) => (s.id === step.id ? { ...s, status: step.status } : s))
      )
      setUpdatingId(null)
      return
    }

    if (newStatus === 'in_progress') {
      await supabase
        .from('boat_status')
        .update({
          current_step_id: step.id,
          current_phase: step.phase,
          updated_at: new Date().toISOString(),
        })
        .eq('voyage_id', voyage.id)
    }

    setUpdatingId(null)
  }

  // Open step actions (edit mode)
  const handleStepTap = (step: RouteStepRow) => {
    if (editMode) {
      setSelectedStep(step)
      setSheetMode('actions')
    } else {
      handleToggleStatus(step)
    }
  }

  // ── Edit step ──
  const handleEditStep = () => {
    if (!selectedStep) return
    setFormData(stepToFormData(selectedStep))
    setSheetMode('edit')
  }

  const handleSaveEdit = async () => {
    if (!selectedStep || !voyage) return
    setSaving(true)

    const supabase = createClient()
    const name = `${formData.from_port} → ${formData.to_port}`
    const { error } = await supabase
      .from('route_steps')
      .update({
        name,
        from_port: formData.from_port,
        to_port: formData.to_port,
        phase: formData.phase || null,
        distance_nm: formData.distance_nm ? parseFloat(formData.distance_nm) : null,
        distance_km: formData.distance_km ? parseFloat(formData.distance_km) : null,
        notes: formData.notes || null,
      })
      .eq('id', selectedStep.id)

    if (!error) {
      await fetchSteps()
    }
    setSaving(false)
    closeSheet()
  }

  // ── Delete step ──
  const handleDeleteStep = async () => {
    if (!selectedStep || !voyage) return
    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from('route_steps')
      .delete()
      .eq('id', selectedStep.id)

    if (!error) {
      // Re-number remaining steps
      const remaining = steps.filter((s) => s.id !== selectedStep.id)
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].order_num !== i + 1) {
          await supabase.from('route_steps').update({ order_num: i + 1 }).eq('id', remaining[i].id)
        }
      }
      await fetchSteps()
    }
    setSaving(false)
    closeSheet()
  }

  // ── Move step up/down ──
  const handleMoveStep = async (direction: 'up' | 'down') => {
    if (!selectedStep || !voyage) return
    setSaving(true)

    const idx = steps.findIndex((s) => s.id === selectedStep.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= steps.length) {
      setSaving(false)
      return
    }

    const other = steps[swapIdx]
    const supabase = createClient()

    await Promise.all([
      supabase.from('route_steps').update({ order_num: other.order_num }).eq('id', selectedStep.id),
      supabase.from('route_steps').update({ order_num: selectedStep.order_num }).eq('id', other.id),
    ])

    await fetchSteps()
    setSaving(false)
    closeSheet()
  }

  // ── Insert step after ──
  const handleInsertAfter = () => {
    setInsertAfterStep(selectedStep)
    setFormData(emptyFormData())
    setSheetMode('add')
  }

  const handleAddStepAtEnd = () => {
    setInsertAfterStep(null)
    setFormData(emptyFormData())
    setSelectedStep(null)
    setSheetMode('add')
  }

  const handleSaveNewStep = async () => {
    if (!voyage) return
    setSaving(true)

    const supabase = createClient()
    const allSteps = [...steps]

    let insertOrder: number
    if (insertAfterStep) {
      insertOrder = insertAfterStep.order_num + 1
      // Shift steps after insertion point
      const toShift = allSteps.filter((s) => s.order_num >= insertOrder)
      for (const s of toShift) {
        await supabase.from('route_steps').update({ order_num: s.order_num + 1 }).eq('id', s.id)
      }
    } else {
      insertOrder = allSteps.length + 1
    }

    const name = formData.name || `${formData.from_port} → ${formData.to_port}`
    const { error } = await supabase.from('route_steps').insert({
      voyage_id: voyage.id,
      order_num: insertOrder,
      name,
      from_port: formData.from_port,
      to_port: formData.to_port,
      phase: formData.phase || null,
      distance_nm: formData.distance_nm ? parseFloat(formData.distance_nm) : null,
      distance_km: formData.distance_km ? parseFloat(formData.distance_km) : null,
      notes: formData.notes || null,
      status: 'to_do' as const,
    })

    if (!error) {
      await fetchSteps()
    }
    setSaving(false)
    closeSheet()
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
      <EmptyState
        illustration="compass"
        title="Pas encore de cap à suivre"
        message="Créez un voyage dans les paramètres et tracez votre route avec l'aide de Bosco."
      />
    )
  }

  if (steps.length === 0 && !editMode) {
    return (
      <EmptyState
        illustration="compass"
        title="L'aventure commence ici"
        message="Votre itinéraire est vierge. Ajoutez votre première étape ou laissez Bosco vous proposer une route."
      >
        <button
          type="button"
          onClick={() => { setEditMode(true); handleAddStepAtEnd() }}
          className="mt-2 flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white active:bg-blue-700"
        >
          <Plus size={16} />
          Ajouter une étape
        </button>
      </EmptyState>
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

  // Estimated navigation days
  const remainingNm = (totalNm - doneNm)
  const remainingKm = (totalKm - doneKm)
  const avgSpeed = boat?.avg_speed_kn ?? 4.5
  const hoursPerDay = 8
  const nmDays = remainingNm > 0 ? remainingNm / avgSpeed / hoursPerDay : 0
  const kmDays = remainingKm > 0 ? remainingKm / 6 / hoursPerDay : 0
  const estimatedNavDays = Math.ceil(nmDays + kmDays)
  const estimatedTotalDays = estimatedNavDays + Math.ceil(estimatedNavDays * 0.3)

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      {/* Header */}
      <div className="mb-5">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {voyage.name}
          </h1>
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className={`flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              editMode
                ? 'bg-blue-600 text-white active:bg-blue-700'
                : 'border border-gray-300 text-gray-700 active:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:active:bg-gray-800'
            }`}
          >
            {editMode ? <X size={14} /> : <Pencil size={14} />}
            {editMode ? 'Terminer' : 'Modifier'}
          </button>
        </div>

        {/* Overall progress */}
        {!editMode && (
          <>
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
          </>
        )}

        {editMode && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tapez sur une étape pour la modifier, supprimer ou déplacer.
          </p>
        )}
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
              className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
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
                        onClick={() => handleStepTap(step)}
                        disabled={updatingId === step.id}
                        className={`flex min-h-[52px] w-full items-start gap-3 px-4 py-3 text-left transition-colors disabled:opacity-60 ${
                          editMode
                            ? 'active:bg-blue-50 dark:active:bg-blue-900/20'
                            : 'active:bg-gray-50 dark:active:bg-gray-800'
                        }`}
                      >
                        {/* Status icon or edit indicator */}
                        <div className="mt-0.5">
                          {updatingId === step.id ? (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                          ) : editMode ? (
                            <Pencil className="h-5 w-5 text-blue-500" />
                          ) : (
                            <StatusIcon status={step.status} />
                          )}
                        </div>

                        {/* Step content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm font-medium ${
                                !editMode && step.status === 'done'
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
                          {!editMode && (
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
                          )}

                          {/* Phase badge in edit mode */}
                          {editMode && step.phase && (
                            <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {step.phase}
                            </span>
                          )}

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

      {/* Add step button (edit mode) */}
      {editMode && (
        <button
          type="button"
          onClick={handleAddStepAtEnd}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 active:border-blue-400 active:text-blue-600 dark:border-gray-600 dark:text-gray-400"
        >
          <Plus size={18} />
          Ajouter une étape
        </button>
      )}

      {/* Stats footer (normal mode) */}
      {!editMode && (
        <footer className="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Résumé
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {totalNm > 0 && (
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {doneNm.toFixed(0)}{' '}
                  <span className="text-sm font-normal text-gray-400">/ {totalNm.toFixed(0)} NM</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Distance maritime</p>
              </div>
            )}

            {totalKm > 0 && (
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {doneKm.toFixed(0)}{' '}
                  <span className="text-sm font-normal text-gray-400">/ {totalKm.toFixed(0)} km</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Distance canaux</p>
              </div>
            )}

            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {doneSteps}{' '}
                <span className="text-sm font-normal text-gray-400">/ {totalSteps}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Étapes terminées</p>
            </div>

            {currentPhase && (
              <div>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {currentPhase}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Phase actuelle</p>
              </div>
            )}

            {estimatedNavDays > 0 && (
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  ~{estimatedNavDays}j
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Navigation restante</p>
              </div>
            )}
            {estimatedTotalDays > 0 && (
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  ~{estimatedTotalDays}j
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total estimé (attente incl.)</p>
              </div>
            )}
          </div>
        </footer>
      )}

      {/* ── Bottom Sheet: Step actions ── */}
      <BottomSheet open={sheetMode === 'actions' && !!selectedStep} onClose={closeSheet}>
        {selectedStep && (
          <div className="space-y-2">
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              {selectedStep.from_port} → {selectedStep.to_port}
            </p>

            <button
              type="button"
              onClick={handleEditStep}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-900 active:bg-gray-100 dark:text-white dark:active:bg-gray-800"
            >
              <Pencil size={18} className="text-blue-500" />
              Modifier l&apos;étape
            </button>

            <button
              type="button"
              onClick={handleInsertAfter}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-900 active:bg-gray-100 dark:text-white dark:active:bg-gray-800"
            >
              <Plus size={18} className="text-green-500" />
              Insérer une étape après
            </button>

            <button
              type="button"
              onClick={() => handleMoveStep('up')}
              disabled={saving || steps.findIndex((s) => s.id === selectedStep.id) === 0}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-900 active:bg-gray-100 disabled:opacity-30 dark:text-white dark:active:bg-gray-800"
            >
              <ArrowUp size={18} className="text-gray-500" />
              Monter
            </button>

            <button
              type="button"
              onClick={() => handleMoveStep('down')}
              disabled={saving || steps.findIndex((s) => s.id === selectedStep.id) === steps.length - 1}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-900 active:bg-gray-100 disabled:opacity-30 dark:text-white dark:active:bg-gray-800"
            >
              <ArrowDown size={18} className="text-gray-500" />
              Descendre
            </button>

            <button
              type="button"
              onClick={() => setSheetMode('delete')}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-900/20"
            >
              <Trash2 size={18} />
              Supprimer l&apos;étape
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ── Bottom Sheet: Edit step ── */}
      <BottomSheet open={sheetMode === 'edit'} onClose={closeSheet}>
        <StepEditForm
          data={formData}
          onChange={setFormData}
          onSave={handleSaveEdit}
          onCancel={closeSheet}
          saving={saving}
          title="Modifier l'étape"
        />
      </BottomSheet>

      {/* ── Bottom Sheet: Add step ── */}
      <BottomSheet open={sheetMode === 'add'} onClose={closeSheet}>
        <StepEditForm
          data={formData}
          onChange={setFormData}
          onSave={handleSaveNewStep}
          onCancel={closeSheet}
          saving={saving}
          title={insertAfterStep ? `Nouvelle étape après ${insertAfterStep.to_port}` : 'Nouvelle étape'}
        />
      </BottomSheet>

      {/* ── Bottom Sheet: Delete confirmation ── */}
      <BottomSheet open={sheetMode === 'delete' && !!selectedStep} onClose={closeSheet}>
        {selectedStep && (
          <div className="space-y-4">
            <p className="text-sm text-gray-900 dark:text-white">
              Supprimer l&apos;étape <strong>{selectedStep.from_port} → {selectedStep.to_port}</strong> ?
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteStep}
                disabled={saving}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-medium text-white active:bg-red-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Supprimer
              </button>
              <button
                type="button"
                onClick={closeSheet}
                className="flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 active:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:active:bg-gray-800"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
