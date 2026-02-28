'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bell,
  BellOff,
  Trash2,
  Clock,
  AlertTriangle,
  Navigation,
  Shield,
  Wrench,
  ShoppingCart,
  Loader2,
  Sparkles,
  CheckCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Database } from '@/lib/supabase/types'

type ReminderRow = Database['public']['Tables']['reminders']['Row']

// ── Helpers ──────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, typeof Bell> = {
  navigation: Navigation,
  safety: Shield,
  maintenance: Wrench,
  provisions: ShoppingCart,
  general: Bell,
}

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navigation',
  safety: 'Sécurité',
  maintenance: 'Entretien',
  provisions: 'Provisions',
  general: 'Général',
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const dateFormatted = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  if (diffDays === 0) return `Aujourd'hui ${timeStr}`
  if (diffDays === 1) return `Demain ${timeStr}`
  if (diffDays === -1) return `Hier ${timeStr}`
  if (diffDays > 1 && diffDays <= 7) return `Dans ${diffDays}j — ${dateFormatted}`
  return `${dateFormatted} ${timeStr}`
}

function isOverdue(reminder: ReminderRow): boolean {
  return reminder.status === 'pending' && new Date(reminder.remind_at) < new Date()
}

// ── Component ────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const { user } = useAuth()
  const { voyage, loading: voyageLoading } = useActiveVoyage()
  const [reminders, setReminders] = useState<ReminderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const loadReminders = useCallback(async () => {
    if (!user || !voyage) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('voyage_id', voyage.id)
      .order('remind_at', { ascending: true })
      .returns<ReminderRow[]>()

    if (error) {
      console.error('Failed to load reminders:', error.message)
    } else {
      setReminders(data ?? [])
    }
    setLoading(false)
  }, [user, voyage])

  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  const handleDismiss = async (id: string) => {
    setActionId(id)
    const supabase = createClient()
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'dismissed' as const })
      .eq('id', id)

    if (!error) {
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'dismissed' as const } : r))
      )
    }
    setActionId(null)
  }

  const handleDelete = async (id: string) => {
    setActionId(id)
    const supabase = createClient()
    const { error } = await supabase.from('reminders').delete().eq('id', id)

    if (!error) {
      setReminders((prev) => prev.filter((r) => r.id !== id))
    }
    setActionId(null)
  }

  if (voyageLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner text="Chargement des rappels..." />
      </div>
    )
  }

  if (!voyage) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Bell size={48} className="text-gray-300 dark:text-gray-700" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Aucun voyage actif
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Créez un voyage pour commencer.
        </p>
      </div>
    )
  }

  const pending = reminders.filter((r) => r.status === 'pending')
  const past = reminders.filter((r) => r.status !== 'pending')

  return (
    <div className="p-4 pb-24">
      <h1 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100">
        Rappels
      </h1>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        {pending.length} à venir · {past.length} passé{past.length > 1 ? 's' : ''}
      </p>

      {reminders.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Bell size={48} className="text-gray-300 dark:text-gray-700" />
          <p className="text-base font-medium text-gray-900 dark:text-gray-100">
            Aucun rappel
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Demandez à Bosco dans le chat pour programmer des rappels.
          </p>
          <div className="mt-2 flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <Sparkles size={12} />
            « Programme un rappel météo chaque matin »
          </div>
        </div>
      )}

      {/* Pending reminders */}
      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Clock size={14} />
            À venir ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((reminder) => {
              const overdue = isOverdue(reminder)
              const CatIcon = CATEGORY_ICONS[reminder.category] ?? Bell
              return (
                <div
                  key={reminder.id}
                  className={`rounded-xl border p-3 ${
                    overdue
                      ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                  }`}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CatIcon size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
                      <span className={`text-xs font-medium ${
                        overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {overdue && <AlertTriangle size={10} className="mr-1 inline" />}
                        {formatDate(reminder.remind_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[reminder.priority]}`}>
                        {PRIORITY_LABELS[reminder.priority]}
                      </span>
                    </div>
                  </div>

                  <p className="mb-2 text-sm text-gray-900 dark:text-gray-100">
                    {reminder.message}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 dark:text-gray-600">
                      {CATEGORY_LABELS[reminder.category]}
                      {reminder.created_by === 'ai' && ' · par Bosco'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDismiss(reminder.id)}
                        disabled={actionId === reminder.id}
                        className="flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors active:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-800"
                      >
                        {actionId === reminder.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <BellOff size={12} />
                        )}
                        Ignorer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(reminder.id)}
                        disabled={actionId === reminder.id}
                        className="flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 transition-colors active:bg-red-50 dark:text-red-400 dark:active:bg-red-900/30"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Past reminders */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            <CheckCircle size={14} />
            Passés ({past.length})
          </h2>
          <div className="space-y-2">
            {past.map((reminder) => {
              const CatIcon = CATEGORY_ICONS[reminder.category] ?? Bell
              return (
                <div
                  key={reminder.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3 opacity-70 dark:border-gray-800 dark:bg-gray-900/50"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CatIcon size={14} className="shrink-0 text-gray-400" />
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(reminder.remind_at)}
                      </span>
                    </div>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      {reminder.status === 'fired' ? 'Envoyé' : 'Ignoré'}
                    </span>
                  </div>
                  <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                    {reminder.message}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 dark:text-gray-600">
                      {CATEGORY_LABELS[reminder.category]}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(reminder.id)}
                      disabled={actionId === reminder.id}
                      className="flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-gray-400 transition-colors active:bg-gray-100 dark:active:bg-gray-800"
                    >
                      {actionId === reminder.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
