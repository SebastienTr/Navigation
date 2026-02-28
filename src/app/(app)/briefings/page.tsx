'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MapPin,
  Wind,
  Waves,
  Shield,
  Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '@/lib/auth/context'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Database } from '@/lib/supabase/types'

type BriefingRow = Database['public']['Tables']['briefings']['Row']
type Verdict = 'GO' | 'STANDBY' | 'NO-GO'

const VERDICT_COLORS: Record<Verdict, { bg: string; text: string; border: string }> = {
  GO: {
    bg: 'bg-green-100 dark:bg-green-950',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-500',
  },
  STANDBY: {
    bg: 'bg-amber-100 dark:bg-amber-950',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-500',
  },
  'NO-GO': {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-500',
  },
}

const VERDICT_DOT_COLORS: Record<Verdict, string> = {
  GO: 'bg-green-500',
  STANDBY: 'bg-amber-500',
  'NO-GO': 'bg-red-500',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Confiance haute',
  medium: 'Confiance moyenne',
  low: 'Confiance basse',
}

type VerdictFilter = 'all' | Verdict

const FILTER_OPTIONS: { label: string; value: VerdictFilter }[] = [
  { label: 'Tous', value: 'all' },
  { label: 'GO', value: 'GO' },
  { label: 'STANDBY', value: 'STANDBY' },
  { label: 'NO-GO', value: 'NO-GO' },
]

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
}

function VerdictBadge({
  verdict,
  large = false,
}: {
  verdict: Verdict
  large?: boolean
}) {
  const colors = VERDICT_COLORS[verdict]
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${colors.bg} ${colors.text} ${
        large ? 'px-4 py-1.5 text-lg' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      {verdict}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <Shield size={12} />
      {CONFIDENCE_LABELS[confidence] ?? confidence}
    </span>
  )
}

interface TodayBriefingProps {
  briefing: BriefingRow
}

function TodayBriefing({ briefing }: TodayBriefingProps) {
  return (
    <div
      className={`rounded-xl border-l-4 bg-white p-5 dark:bg-gray-900 ${
        briefing.verdict ? VERDICT_COLORS[briefing.verdict].border : 'border-gray-300'
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Briefing du jour
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatDate(briefing.date)} à {new Date(briefing.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {briefing.verdict && <VerdictBadge verdict={briefing.verdict} large />}
      </div>

      {briefing.confidence && (
        <div className="mb-3">
          <ConfidenceBadge confidence={briefing.confidence} />
        </div>
      )}

      {/* Wind & Sea summary */}
      <div className="mb-3 flex flex-wrap gap-3">
        {briefing.wind && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <Wind size={14} className="shrink-0" />
            <span>{briefing.wind}</span>
          </div>
        )}
        {briefing.sea && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <Waves size={14} className="shrink-0" />
            <span>{briefing.sea}</span>
          </div>
        )}
      </div>

      {/* Position */}
      {briefing.position && (
        <div className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <MapPin size={14} className="shrink-0" />
          <span>{briefing.position}</span>
          {briefing.destination && (
            <span className="text-gray-400 dark:text-gray-500">
              {' '}→ {briefing.destination}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div className="prose-briefing text-gray-700 dark:text-gray-300">
          <ReactMarkdown>{briefing.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

interface BriefingCardProps {
  briefing: BriefingRow
  isExpanded: boolean
  onToggle: () => void
}

function BriefingCard({ briefing, isExpanded, onToggle }: BriefingCardProps) {
  return (
    <div className="rounded-xl bg-white shadow-sm dark:bg-gray-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* Verdict dot */}
        <div
          className={`h-3 w-3 shrink-0 rounded-full ${
            briefing.verdict ? VERDICT_DOT_COLORS[briefing.verdict] : 'bg-gray-300'
          }`}
        />

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formatShortDate(briefing.date)} · {new Date(briefing.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {briefing.verdict && <VerdictBadge verdict={briefing.verdict} />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {briefing.position && (
              <span className="flex items-center gap-1">
                <MapPin size={10} />
                {briefing.position}
              </span>
            )}
            {briefing.wind && (
              <span className="flex items-center gap-1">
                <Wind size={10} />
                {briefing.wind}
              </span>
            )}
          </div>
        </div>

        {/* Expand icon */}
        {isExpanded ? (
          <ChevronUp size={20} className="shrink-0 text-gray-400" />
        ) : (
          <ChevronDown size={20} className="shrink-0 text-gray-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800">
          <div className="mb-2 flex flex-wrap gap-2">
            {briefing.confidence && (
              <ConfidenceBadge confidence={briefing.confidence} />
            )}
            {briefing.sea && (
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Waves size={12} />
                {briefing.sea}
              </span>
            )}
            {briefing.destination && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                → {briefing.destination}
              </span>
            )}
          </div>
          <div className="prose-briefing text-gray-700 dark:text-gray-300">
            <ReactMarkdown>{briefing.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BriefingsPage() {
  const { user } = useAuth()
  const { voyage, loading: voyageLoading } = useActiveVoyage()

  const [briefings, setBriefings] = useState<BriefingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [filter, setFilter] = useState<VerdictFilter>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Load briefings
  const loadBriefings = useCallback(async () => {
    if (!user || !voyage) return

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('briefings')
      .select('*')
      .eq('voyage_id', voyage.id)
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .returns<BriefingRow[]>()

    if (error) {
      console.error('Failed to load briefings:', error.message)
    } else if (data) {
      setBriefings(data)
    }
    setLoading(false)
  }, [user, voyage])

  useEffect(() => {
    if (!voyageLoading && user && voyage) {
      loadBriefings()
    } else if (!voyageLoading) {
      setLoading(false)
    }
  }, [user, voyage, voyageLoading, loadBriefings])

  // Generate briefing
  const handleGenerate = async () => {
    if (!voyage || generating) return

    setGenerating(true)
    try {
      const response = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voyageId: voyage.id }),
      })

      if (!response.ok) {
        throw new Error(`Erreur serveur (${response.status})`)
      }

      // Refresh the list
      await loadBriefings()
    } catch (err) {
      console.error('Failed to generate briefing:', err)
    } finally {
      setGenerating(false)
    }
  }

  // Toggle accordion
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Filter logic
  const todayBriefing = briefings.find((b) => isToday(b.date))
  const historyBriefings = briefings.filter((b) => !isToday(b.date))
  const filteredHistory =
    filter === 'all'
      ? historyBriefings
      : historyBriefings.filter((b) => b.verdict === filter)

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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <FileText size={48} className="text-gray-300 dark:text-gray-700" />
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Aucun voyage actif
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Créez un voyage dans les réglages pour voir vos briefings.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-950/80">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Briefings
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {voyage.name}
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors active:bg-blue-700 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            <span className="hidden min-[400px]:inline">
              {generating ? 'Génération...' : 'Générer'}
            </span>
          </button>
        </div>
      </header>

      <div className="px-4 py-4">
        {briefings.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FileText size={48} className="text-gray-300 dark:text-gray-700" />
            <p className="text-base font-medium text-gray-900 dark:text-gray-100">
              Aucun briefing disponible
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Le premier sera généré demain à 5h.
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="mt-2 flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors active:bg-blue-700 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Générer un briefing maintenant
            </button>
          </div>
        ) : (
          <>
            {/* Today's briefing */}
            {todayBriefing && (
              <div className="mb-6">
                <TodayBriefing briefing={todayBriefing} />
              </div>
            )}

            {/* Filter bar */}
            {historyBriefings.length > 0 && (
              <>
                <div className="mb-3 flex items-center gap-2 overflow-x-auto">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilter(option.value)}
                      className={`min-h-[36px] shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        filter === option.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 active:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:active:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* History list */}
                <div className="flex flex-col gap-2">
                  {filteredHistory.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                      Aucun briefing pour ce filtre.
                    </p>
                  ) : (
                    filteredHistory.map((briefing) => (
                      <BriefingCard
                        key={briefing.id}
                        briefing={briefing}
                        isExpanded={expandedIds.has(briefing.id)}
                        onToggle={() => toggleExpanded(briefing.id)}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
