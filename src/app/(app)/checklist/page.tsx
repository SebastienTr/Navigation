'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  CheckCircle2,
  Circle,
  Plus,
  X,
  Loader2,
} from 'lucide-react'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Database } from '@/lib/supabase/types'

type ChecklistRow = Database['public']['Tables']['checklist']['Row']
type Category = NonNullable<ChecklistRow['category']>
type Priority = NonNullable<ChecklistRow['priority']>

// ── Category config ────────────────────────────────────────────────────

interface CategoryConfig {
  label: string
  color: string
  bgLight: string
  bgDark: string
}

const CATEGORIES: Record<Category, CategoryConfig> = {
  Safety: {
    label: 'Sécurité',
    color: 'text-red-500',
    bgLight: 'bg-red-50',
    bgDark: 'dark:bg-red-950',
  },
  Propulsion: {
    label: 'Propulsion',
    color: 'text-orange-500',
    bgLight: 'bg-orange-50',
    bgDark: 'dark:bg-orange-950',
  },
  Navigation: {
    label: 'Navigation',
    color: 'text-blue-500',
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-blue-950',
  },
  Rigging: {
    label: 'Gréement',
    color: 'text-yellow-500',
    bgLight: 'bg-yellow-50',
    bgDark: 'dark:bg-yellow-950',
  },
  Comfort: {
    label: 'Confort',
    color: 'text-green-500',
    bgLight: 'bg-green-50',
    bgDark: 'dark:bg-green-950',
  },
  Admin: {
    label: 'Admin',
    color: 'text-gray-500',
    bgLight: 'bg-gray-50',
    bgDark: 'dark:bg-gray-800',
  },
}

const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]

// ── Priority config ────────────────────────────────────────────────────

interface PriorityConfig {
  label: string
  bg: string
  text: string
}

const PRIORITIES: Record<Priority, PriorityConfig> = {
  Critical: {
    label: 'Critique',
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-700 dark:text-red-300',
  },
  High: {
    label: 'Haut',
    bg: 'bg-orange-100 dark:bg-orange-900',
    text: 'text-orange-700 dark:text-orange-300',
  },
  Normal: {
    label: 'Normal',
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-700 dark:text-blue-300',
  },
  Low: {
    label: 'Bas',
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
  },
}

const PRIORITY_KEYS = Object.keys(PRIORITIES) as Priority[]

// ── Filter types ───────────────────────────────────────────────────────

type CategoryFilter = 'all' | Category
type PriorityFilter = 'all' | Priority

const CATEGORY_FILTER_OPTIONS: { label: string; value: CategoryFilter }[] = [
  { label: 'Tous', value: 'all' },
  ...CATEGORY_KEYS.map((key) => ({ label: CATEGORIES[key].label, value: key as CategoryFilter })),
]

const PRIORITY_FILTER_OPTIONS: { label: string; value: PriorityFilter }[] = [
  { label: 'Tous', value: 'all' },
  ...PRIORITY_KEYS.map((key) => ({ label: PRIORITIES[key].label, value: key as PriorityFilter })),
]

// ── Priority badge component ───────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const config = PRIORITIES[priority]
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  )
}

// ── Add task modal ─────────────────────────────────────────────────────

interface AddTaskModalProps {
  onClose: () => void
  onSave: (task: string, category: Category, priority: Priority) => Promise<void>
}

function AddTaskModal({ onClose, onSave }: AddTaskModalProps) {
  const [task, setTask] = useState('')
  const [category, setCategory] = useState<Category>('Safety')
  const [priority, setPriority] = useState<Priority>('Normal')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!task.trim() || saving) return
    setSaving(true)
    await onSave(task.trim(), category, priority)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Nouvelle tâche
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-gray-400 transition-colors active:bg-gray-100 dark:active:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Task input */}
        <div className="mb-4">
          <label
            htmlFor="task-input"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Tâche
          </label>
          <input
            id="task-input"
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Décrivez la tâche..."
            autoFocus
            className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
        </div>

        {/* Category select */}
        <div className="mb-4">
          <label
            htmlFor="category-select"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Catégorie
          </label>
          <select
            id="category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          >
            {CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {CATEGORIES[key].label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority select */}
        <div className="mb-5">
          <label
            htmlFor="priority-select"
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Priorité
          </label>
          <select
            id="priority-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          >
            {PRIORITY_KEYS.map((key) => (
              <option key={key} value={key}>
                {PRIORITIES[key].label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors active:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:active:bg-gray-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!task.trim() || saving}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors active:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────

export default function ChecklistPage() {
  const { voyage, loading: voyageLoading } = useActiveVoyage()

  const [items, setItems] = useState<ChecklistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Load items
  const loadItems = useCallback(async () => {
    if (!voyage) return

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('checklist')
      .select('*')
      .eq('voyage_id', voyage.id)
      .order('category', { ascending: true })
      .order('priority', { ascending: true })
      .returns<ChecklistRow[]>()

    if (error) {
      console.error('Failed to load checklist:', error.message)
    } else if (data) {
      setItems(data)
    }
    setLoading(false)
  }, [voyage])

  useEffect(() => {
    if (!voyageLoading && voyage) {
      loadItems()
    } else if (!voyageLoading) {
      setLoading(false)
    }
  }, [voyage, voyageLoading, loadItems])

  // Toggle task status
  const toggleItem = useCallback(
    async (item: ChecklistRow) => {
      if (togglingIds.has(item.id)) return

      const newStatus: ChecklistRow['status'] = item.status === 'done' ? 'to_do' : 'done'
      const completedAt: string | null = newStatus === 'done' ? new Date().toISOString() : null

      // Optimistic update
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: newStatus as ChecklistRow['status'], completed_at: completedAt }
            : i
        )
      )
      setTogglingIds((prev) => new Set(prev).add(item.id))

      const supabase = createClient()
      const { error } = await supabase
        .from('checklist')
        .update({ status: newStatus, completed_at: completedAt } as Database['public']['Tables']['checklist']['Update'])
        .eq('id', item.id)

      if (error) {
        console.error('Failed to toggle checklist item:', error.message)
        // Revert optimistic update
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: item.status, completed_at: item.completed_at }
              : i
          )
        )
      }

      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    },
    [togglingIds]
  )

  // Add task
  const handleAddTask = useCallback(
    async (task: string, category: Category, priority: Priority) => {
      if (!voyage) return

      const supabase = createClient()
      const { error } = await supabase.from('checklist').insert({
        voyage_id: voyage.id,
        task,
        category,
        priority,
        status: 'to_do',
      })

      if (error) {
        console.error('Failed to add checklist item:', error.message)
      } else {
        await loadItems()
      }
    },
    [voyage, loadItems]
  )

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false
      return true
    })
  }, [items, categoryFilter, priorityFilter])

  // Group by category
  const groupedItems = useMemo(() => {
    const groups = new Map<Category, ChecklistRow[]>()
    for (const item of filteredItems) {
      const cat = item.category ?? 'Admin'
      const existing = groups.get(cat)
      if (existing) {
        existing.push(item)
      } else {
        groups.set(cat, [item])
      }
    }
    // Sort groups according to CATEGORY_KEYS order
    const sorted = new Map<Category, ChecklistRow[]>()
    for (const key of CATEGORY_KEYS) {
      const group = groups.get(key)
      if (group) {
        sorted.set(key, group)
      }
    }
    return sorted
  }, [filteredItems])

  // Progress stats
  const doneCount = items.filter((i) => i.status === 'done').length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // Loading state
  if (voyageLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner text="Chargement..." />
      </div>
    )
  }

  // No active voyage
  if (!voyage) {
    return (
      <EmptyState
        illustration="anchor"
        title="Checklist au mouillage"
        message="Créez un voyage dans les paramètres et Bosco vous aidera à ne rien oublier avant le départ."
      />
    )
  }

  return (
    <div className="flex flex-col pb-24">
      {/* Header with progress */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-950/80">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Checklist
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {doneCount}/{totalCount} terminés
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {progressPercent}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Filter bars */}
      <div className="space-y-2 px-4 pt-3">
        {/* Category filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORY_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategoryFilter(option.value)}
              className={`min-h-[36px] shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:active:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Priority filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {PRIORITY_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPriorityFilter(option.value)}
              className={`min-h-[36px] shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                priorityFilter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:active:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-3">
        {items.length === 0 ? (
          /* Empty state */
          <EmptyState
            illustration="anchor"
            title="Rien à vérifier pour l'instant"
            message="Ajoutez votre première tâche avec le bouton + ou demandez à Bosco dans le chat de préparer une checklist."
            compact
          />
        ) : filteredItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            Aucune tâche pour ces filtres.
          </p>
        ) : (
          /* Grouped items */
          <div className="flex flex-col gap-4">
            {Array.from(groupedItems.entries()).map(([category, categoryItems]) => {
              const config = CATEGORIES[category]
              return (
                <section key={category}>
                  {/* Category header */}
                  <div
                    className={`mb-2 flex items-center gap-2 rounded-lg px-3 py-2 ${config.bgLight} ${config.bgDark}`}
                  >
                    <span className={`text-sm font-semibold ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {categoryItems.filter((i) => i.status === 'done').length}/
                      {categoryItems.length}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="flex flex-col gap-1">
                    {categoryItems.map((item) => {
                      const isDone = item.status === 'done'
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-3 rounded-lg bg-white px-3 py-3 shadow-sm dark:bg-gray-900"
                        >
                          {/* Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleItem(item)}
                            disabled={togglingIds.has(item.id)}
                            aria-label={isDone ? 'Marquer comme à faire' : 'Marquer comme fait'}
                            className="mt-0.5 flex h-[44px] w-[44px] shrink-0 items-center justify-center -ml-2 -mt-1.5"
                          >
                            {isDone ? (
                              <CheckCircle2
                                size={22}
                                className="text-green-500"
                              />
                            ) : (
                              <Circle
                                size={22}
                                className="text-gray-300 dark:text-gray-600"
                              />
                            )}
                          </button>

                          {/* Task content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm ${
                                  isDone
                                    ? 'text-gray-400 line-through dark:text-gray-500'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}
                              >
                                {item.task}
                              </span>
                              {item.priority && (
                                <PriorityBadge priority={item.priority} />
                              )}
                            </div>
                            {item.notes && (
                              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        aria-label="Ajouter une tâche"
        className="fixed bottom-24 right-4 z-20 flex h-13 w-13 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-transform active:scale-95 dark:bg-blue-500"
      >
        <Plus size={24} />
      </button>

      {/* Add task modal */}
      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddTask}
        />
      )}
    </div>
  )
}
