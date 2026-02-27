// ── Trigger Evaluation Engine ──────────────────────────────────────────────
// Evaluates the 5 MVP trigger rules for a given user/voyage context.
// Gathers all context from Supabase, fetches weather, runs rules,
// and uses Claude to generate contextual notification messages.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { TriggerType, WeatherData } from '@/types'
import {
  getVoyageBoatStatus,
  getLatestBriefing,
  getVoyageLogs,
  getVoyageChecklist,
  getVoyageRouteSteps,
} from '@/lib/supabase/queries'
import { callClaude, MODEL_CHAT } from '@/lib/ai/proxy'
import { buildTriggerSystemPrompt } from '@/lib/ai/prompts'
import { buildTriggerContext } from '@/lib/ai/context'
import {
  checkWeatherChange,
  checkLogReminder,
  checkDepartureWatch,
  checkCriticalChecklist,
  checkLowFuel,
  type TriggerRuleContext,
} from './rules'

export type { TriggerRuleContext } from './rules'

type Client = SupabaseClient<Database>

// ── Types ─────────────────────────────────────────────────────────────────

export interface FiredTrigger {
  type: TriggerType
  details: string
  message: string
}

// ── Weather fetch helper ────────────────────────────────────────────────────

async function fetchCurrentWeather(
  lat: number,
  lon: number
): Promise<WeatherData | null> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
    })

    const response = await fetch(`${baseUrl}/api/weather?${params}`, {
      next: { revalidate: 1800 },
    })

    if (!response.ok) return null
    return (await response.json()) as WeatherData
  } catch {
    return null
  }
}

// ── Claude message generation ────────────────────────────────────────────

interface TriggerNotification {
  title: string
  body: string
  priority: 'high' | 'medium' | 'low'
}

async function generateTriggerMessage(
  supabase: Client,
  userId: string,
  voyageId: string,
  triggerType: TriggerType,
  details: string
): Promise<string> {
  try {
    const triggerCtx = await buildTriggerContext(supabase, userId, voyageId)
    const systemPrompt = buildTriggerSystemPrompt(triggerCtx, triggerType)

    const response = await callClaude({
      systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Alerte declenchee. Details supplementaires : ${details}`,
        },
      ],
      model: MODEL_CHAT,
      maxTokens: 512,
    })

    // Try to parse the JSON response
    try {
      const parsed = JSON.parse(response) as TriggerNotification
      return `${parsed.title} — ${parsed.body}`
    } catch {
      // If JSON parsing fails, use the raw response
      return response.slice(0, 200)
    }
  } catch (error) {
    console.error(
      `Erreur lors de la generation du message pour ${triggerType}:`,
      error instanceof Error ? error.message : 'Erreur inconnue'
    )
    // Fallback: use the raw details
    return details
  }
}

// ── Main evaluation function ─────────────────────────────────────────────

/**
 * Evaluate all 5 trigger rules for a given user and voyage.
 * Gathers context from Supabase, fetches weather if position is known,
 * runs all rules, and generates notification messages for fired triggers.
 */
export async function evaluateTriggers(
  supabase: Client,
  userId: string,
  voyageId: string
): Promise<FiredTrigger[]> {
  // Gather context from Supabase in parallel
  const [boatStatus, latestBriefing, logs, checklist, routeSteps] =
    await Promise.all([
      getVoyageBoatStatus(supabase, voyageId).catch(() => null),
      getLatestBriefing(supabase, voyageId).catch(() => null),
      getVoyageLogs(supabase, voyageId, 1).catch(() => []),
      getVoyageChecklist(supabase, voyageId).catch(() => []),
      getVoyageRouteSteps(supabase, voyageId).catch(() => []),
    ])

  // Fetch current weather if we have a position
  let currentWeather: WeatherData | null = null
  if (boatStatus?.current_lat && boatStatus?.current_lon) {
    currentWeather = await fetchCurrentWeather(
      boatStatus.current_lat,
      boatStatus.current_lon
    )
  }

  // Build the rule evaluation context
  const ruleCtx: TriggerRuleContext = {
    boatStatus,
    latestBriefing,
    latestLog: logs.length > 0 ? logs[0] : null,
    checklist,
    routeSteps,
    currentWeather,
  }

  // Run all 5 rules
  const ruleResults: Array<{
    type: TriggerType
    fired: boolean
    details: string
  }> = [
    { type: 'weather_change', ...checkWeatherChange(ruleCtx) },
    { type: 'log_reminder', ...checkLogReminder(ruleCtx) },
    { type: 'departure_watch', ...checkDepartureWatch(ruleCtx) },
    { type: 'critical_checklist', ...checkCriticalChecklist(ruleCtx) },
    { type: 'low_fuel', ...checkLowFuel(ruleCtx) },
  ]

  // Filter to only fired triggers
  const fired = ruleResults.filter((r) => r.fired)

  if (fired.length === 0) return []

  // Generate Claude messages for each fired trigger in parallel
  const firedTriggers = await Promise.all(
    fired.map(async (trigger) => {
      const message = await generateTriggerMessage(
        supabase,
        userId,
        voyageId,
        trigger.type,
        trigger.details
      )
      return {
        type: trigger.type,
        details: trigger.details,
        message,
      }
    })
  )

  return firedTriggers
}
