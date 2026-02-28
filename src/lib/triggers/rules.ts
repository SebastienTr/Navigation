// ── Trigger Rules ─────────────────────────────────────────────────────────────
// 5 MVP trigger rules evaluated every 4h (6am-10pm) for all active voyages.
// Simple if/then conditions — no complex event processing.

import type { Database } from '@/lib/supabase/types'
import type { WeatherData } from '@/types'

type BoatStatusRow = Database['public']['Tables']['boat_status']['Row']
type BriefingRow = Database['public']['Tables']['briefings']['Row']
type LogRow = Database['public']['Tables']['logs']['Row']
type ChecklistRow = Database['public']['Tables']['checklist']['Row']
type RouteStepRow = Database['public']['Tables']['route_steps']['Row']

// ── Types ─────────────────────────────────────────────────────────────────

export interface TriggerRuleContext {
  boatStatus: BoatStatusRow | null
  latestBriefing: BriefingRow | null
  latestLog: LogRow | null
  checklist: ChecklistRow[]
  routeSteps: RouteStepRow[]
  currentWeather: WeatherData | null
}

export interface TriggerResult {
  fired: boolean
  details: string
}

// ── Fuel level mapping ────────────────────────────────────────────────────

const FUEL_LEVEL_MAP: Record<string, number> = {
  full: 100,
  '3/4': 75,
  half: 50,
  '1/4': 25,
  reserve: 10,
  empty: 0,
}

function fuelPercent(fuelTank: string | null): number | null {
  if (!fuelTank) return null
  return FUEL_LEVEL_MAP[fuelTank] ?? null
}

// ── Rule 1: Weather Change ────────────────────────────────────────────────
// Wind forecast changes > 10 kn vs morning briefing
// Note: This rule compares the weather summary text against the briefing.
// It extracts wind numbers from both text sources for comparison.

export function checkWeatherChange(ctx: TriggerRuleContext): TriggerResult {
  if (!ctx.latestBriefing || !ctx.currentWeather) {
    return { fired: false, details: 'Donnees meteo ou briefing indisponibles.' }
  }

  // Compare briefing wind data with current weather summary
  const briefingWind = ctx.latestBriefing.wind
  if (!briefingWind) {
    return { fired: false, details: 'Pas de donnees de vent dans le briefing.' }
  }

  // Try to extract wind numbers from the weather summary
  const summary = ctx.currentWeather.summary ?? ''
  const summaryWindMatch = summary.match(
    /(?:Vent|Rafales\s*max)\s*[:.]?\s*(\d+)(?:\s*-\s*(\d+))?\s*(?:kn|noeuds|nds)/i
  )
  if (!summaryWindMatch) {
    return { fired: false, details: 'Impossible de parser le vent du resume meteo.' }
  }

  const currentMaxWind = summaryWindMatch[2]
    ? parseInt(summaryWindMatch[2], 10)
    : parseInt(summaryWindMatch[1], 10)

  // Try to extract a wind number from the briefing text (e.g. "15-20 kn")
  const windMatch = briefingWind.match(
    /(\d+)\s*(?:-\s*(\d+))?\s*(?:kn|noeuds|nds)/i
  )
  if (!windMatch) {
    return { fired: false, details: 'Impossible de parser le vent du briefing.' }
  }

  const briefingMaxWind = windMatch[2]
    ? parseInt(windMatch[2], 10)
    : parseInt(windMatch[1], 10)

  const diff = Math.abs(currentMaxWind - briefingMaxWind)

  if (diff > 10) {
    return {
      fired: true,
      details: `Vent actuel : ${currentMaxWind} kn (briefing du matin : ${briefingMaxWind} kn). Ecart : ${Math.round(diff)} kn.`,
    }
  }

  return {
    fired: false,
    details: `Vent stable. Actuel : ${currentMaxWind} kn, briefing : ${briefingMaxWind} kn.`,
  }
}

// ── Rule 2: Log Reminder ──────────────────────────────────────────────────
// No log in 12h

export function checkLogReminder(ctx: TriggerRuleContext): TriggerResult {
  if (!ctx.latestLog) {
    return {
      fired: true,
      details: 'Aucune entree de journal trouvee pour ce voyage.',
    }
  }

  const logDate = new Date(ctx.latestLog.created_at)
  const now = new Date()
  const hoursSinceLastLog =
    (now.getTime() - logDate.getTime()) / (1000 * 60 * 60)

  if (hoursSinceLastLog > 12) {
    return {
      fired: true,
      details: `Derniere entree il y a ${Math.round(hoursSinceLastLog)} heures (${ctx.latestLog.position}).`,
    }
  }

  return {
    fired: false,
    details: `Derniere entree il y a ${Math.round(hoursSinceLastLog)} heures.`,
  }
}

// ── Rule 3: Departure Watch ───────────────────────────────────────────────
// Tomorrow's briefing = GO

export function checkDepartureWatch(ctx: TriggerRuleContext): TriggerResult {
  if (!ctx.latestBriefing) {
    return { fired: false, details: 'Aucun briefing disponible.' }
  }

  if (ctx.latestBriefing.verdict !== 'GO') {
    return {
      fired: false,
      details: `Dernier verdict : ${ctx.latestBriefing.verdict ?? 'N/A'}. Pas de depart prevu.`,
    }
  }

  // Check if the latest briefing is from today and verdict is GO
  const briefingDate = new Date(ctx.latestBriefing.date)
  const today = new Date()
  const isToday =
    briefingDate.getFullYear() === today.getFullYear() &&
    briefingDate.getMonth() === today.getMonth() &&
    briefingDate.getDate() === today.getDate()

  if (isToday) {
    // Only trigger if in port (not already sailing)
    if (
      ctx.boatStatus?.nav_status === 'in_port' ||
      ctx.boatStatus?.nav_status === 'at_anchor'
    ) {
      // Find unchecked critical/high priority checklist items
      const pendingCritical = ctx.checklist.filter(
        (item) =>
          (item.priority === 'Critical' || item.priority === 'High') &&
          (item.status === 'to_do' || item.status === 'in_progress')
      )

      const detail = pendingCritical.length > 0
        ? `Briefing GO pour demain. ${pendingCritical.length} items prioritaires restants : ${pendingCritical.map((i) => i.task).join(', ')}.`
        : 'Briefing GO pour demain. Checklist pre-depart completee.'

      return { fired: true, details: detail }
    }
  }

  return {
    fired: false,
    details: `Briefing GO mais pas de depart imminent (date : ${ctx.latestBriefing.date}).`,
  }
}

// ── Rule 4: Critical Checklist ────────────────────────────────────────────
// Critical item unchecked + departure < 3 days

export function checkCriticalChecklist(ctx: TriggerRuleContext): TriggerResult {
  const criticalUnchecked = ctx.checklist.filter(
    (item) =>
      item.priority === 'Critical' &&
      (item.status === 'to_do' || item.status === 'in_progress')
  )

  if (criticalUnchecked.length === 0) {
    return { fired: false, details: 'Aucun element critique en attente.' }
  }

  // Check if we might be departing soon (last briefing was GO or STANDBY)
  const recentGo =
    ctx.latestBriefing?.verdict === 'GO' ||
    ctx.latestBriefing?.verdict === 'STANDBY'

  // Also check boat status — in port and ready for departure
  const inPort =
    ctx.boatStatus?.nav_status === 'in_port' ||
    ctx.boatStatus?.nav_status === 'at_anchor'

  if (recentGo && inPort) {
    const itemNames = criticalUnchecked
      .slice(0, 5)
      .map((i) => i.task)
      .join(', ')

    return {
      fired: true,
      details: `${criticalUnchecked.length} item(s) critique(s) non fait(s) : ${itemNames}.`,
    }
  }

  return {
    fired: false,
    details: `${criticalUnchecked.length} item(s) critique(s) en attente, pas de depart imminent.`,
  }
}

// ── Rule 5: Low Fuel ──────────────────────────────────────────────────────
// Fuel < 25%

export function checkLowFuel(ctx: TriggerRuleContext): TriggerResult {
  // Check boat status fuel level
  const level = fuelPercent(ctx.boatStatus?.fuel_tank ?? null)

  if (level === null) {
    return { fired: false, details: 'Niveau de carburant non renseigne.' }
  }

  if (level <= 25) {
    const jerricans = ctx.boatStatus?.jerricans ?? 0
    const fuelLabel = ctx.boatStatus?.fuel_tank ?? 'inconnu'

    // Find next port from route
    const nextStep = ctx.routeSteps.find(
      (s) => s.status === 'to_do' || s.status === 'in_progress'
    )
    const nextPortInfo = nextStep
      ? ` Prochain port : ${nextStep.to_port}.`
      : ''

    return {
      fired: true,
      details: `Reservoir : ${fuelLabel}${jerricans > 0 ? ` + ${jerricans} jerrican(s)` : ''}. Niveau critique.${nextPortInfo}`,
    }
  }

  return {
    fired: false,
    details: `Niveau carburant : ${ctx.boatStatus?.fuel_tank ?? 'inconnu'}.`,
  }
}
