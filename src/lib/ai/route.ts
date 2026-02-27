import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { RouteProposal, RouteStep } from '@/types'
import { callClaude, MODEL_SONNET } from './proxy'
import { buildRouteSystemPrompt } from './prompts'
import { getUserBoats, getNavProfiles } from '@/lib/supabase/queries'

type Client = SupabaseClient<Database>

// ── Types internes pour le parsing JSON ────────────────────────────────────

interface RawRouteStep {
  order_num: number
  name: string
  from_port: string
  to_port: string
  from_lat: number
  from_lon: number
  to_lat: number
  to_lon: number
  distance_nm: number | null
  distance_km: number | null
  phase: string
  notes: string
}

interface RawRouteProposal {
  name: string
  summary: string
  total_distance_nm: number
  total_distance_km: number
  estimated_days: number
  pros: string[]
  cons: string[]
  warnings: string[]
  steps: RawRouteStep[]
}

interface RawRouteResponse {
  routes: RawRouteProposal[]
}

// ── Parsing et validation ──────────────────────────────────────────────────

function parseRouteStep(raw: RawRouteStep): RouteStep {
  return {
    orderNum: raw.order_num,
    name: raw.name,
    fromPort: raw.from_port,
    toPort: raw.to_port,
    fromLat: raw.from_lat,
    fromLon: raw.from_lon,
    toLat: raw.to_lat,
    toLon: raw.to_lon,
    distanceNm: raw.distance_nm,
    distanceKm: raw.distance_km,
    phase: raw.phase,
    notes: raw.notes,
  }
}

function parseRouteProposal(raw: RawRouteProposal): RouteProposal {
  return {
    name: raw.name,
    summary: raw.summary,
    totalDistanceNm: raw.total_distance_nm,
    totalDistanceKm: raw.total_distance_km,
    estimatedDays: raw.estimated_days,
    pros: raw.pros,
    cons: raw.cons,
    warnings: raw.warnings,
    steps: raw.steps.map(parseRouteStep),
  }
}

/**
 * Extraire le JSON de la reponse Claude.
 * Claude peut parfois entourer le JSON de markdown (```json ... ```).
 */
function extractJSON(text: string): RawRouteResponse {
  // Tenter d'abord un parsing direct
  try {
    return JSON.parse(text) as RawRouteResponse
  } catch {
    // Tenter d'extraire le JSON d'un bloc de code markdown
  }

  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonBlockMatch?.[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1]) as RawRouteResponse
    } catch {
      // Continuer vers le fallback
    }
  }

  // Dernier recours: chercher le premier { et le dernier }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as RawRouteResponse
    } catch {
      throw new Error('Impossible de parser la reponse JSON de Claude pour les routes')
    }
  }

  throw new Error('Aucun JSON valide trouve dans la reponse de Claude')
}

/**
 * Valider qu'une proposition de route a les champs requis.
 */
function validateRouteProposal(proposal: RawRouteProposal, index: number): void {
  if (!proposal.name) {
    throw new Error(`Route ${index + 1}: nom manquant`)
  }
  if (!proposal.steps || proposal.steps.length === 0) {
    throw new Error(`Route "${proposal.name}": aucune etape definie`)
  }
  for (let i = 0; i < proposal.steps.length; i++) {
    const step = proposal.steps[i]
    if (!step.from_port || !step.to_port) {
      throw new Error(
        `Route "${proposal.name}", etape ${i + 1}: ports de depart/arrivee manquants`
      )
    }
    if (
      typeof step.from_lat !== 'number' ||
      typeof step.from_lon !== 'number' ||
      typeof step.to_lat !== 'number' ||
      typeof step.to_lon !== 'number'
    ) {
      throw new Error(
        `Route "${proposal.name}", etape ${i + 1} (${step.name}): coordonnees manquantes ou invalides`
      )
    }
  }
}

// ── Recuperer bateau et profil de l'utilisateur ────────────────────────────

async function getUserBoatAndProfile(supabase: Client, userId: string) {
  const [boats, profiles] = await Promise.all([
    getUserBoats(supabase, userId),
    getNavProfiles(supabase, userId),
  ])

  // Prendre le premier bateau et profil (le plus recent)
  const boat = boats[0]
  const profile = profiles[0]

  if (!boat) {
    throw new Error('Aucun bateau configure. Completez d\'abord l\'onboarding.')
  }

  return { boat, profile: profile ?? null }
}

// ── Generation de propositions de route ────────────────────────────────────

export async function generateRouteProposals(
  supabase: Client,
  userId: string,
  departure: string,
  arrival: string
): Promise<RouteProposal[]> {
  const { boat, profile } = await getUserBoatAndProfile(supabase, userId)

  const systemPrompt = buildRouteSystemPrompt({
    departure,
    arrival,
    boat: {
      name: boat.name,
      type: boat.type,
      lengthM: boat.length_m,
      draftM: boat.draft_m,
      airDraftM: boat.air_draft_m,
      engineType: boat.engine_type,
      fuelCapacityHours: boat.fuel_capacity_hours,
      avgSpeedKn: boat.avg_speed_kn,
    },
    profile: {
      experience: profile?.experience ?? null,
      crewMode: profile?.crew_mode ?? null,
      riskTolerance: profile?.risk_tolerance ?? null,
      nightSailing: profile?.night_sailing ?? null,
      maxContinuousHours: profile?.max_continuous_hours ?? null,
    },
  })

  const response = await callClaude({
    systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Propose 2 a 3 itineraires pour un convoyage de ${departure} a ${arrival}. Reponds en JSON.`,
      },
    ],
    model: MODEL_SONNET,
    maxTokens: 8192,
  })

  const parsed = extractJSON(response)

  if (!parsed.routes || parsed.routes.length === 0) {
    throw new Error('Claude n\'a propose aucun itineraire')
  }

  // Valider chaque proposition
  parsed.routes.forEach(validateRouteProposal)

  return parsed.routes.map(parseRouteProposal)
}

// ── Generation d'un itineraire personnalise ────────────────────────────────

export async function generateCustomRoute(
  supabase: Client,
  userId: string,
  departure: string,
  arrival: string,
  description: string
): Promise<RouteProposal[]> {
  const { boat, profile } = await getUserBoatAndProfile(supabase, userId)

  const systemPrompt = buildRouteSystemPrompt({
    departure,
    arrival,
    boat: {
      name: boat.name,
      type: boat.type,
      lengthM: boat.length_m,
      draftM: boat.draft_m,
      airDraftM: boat.air_draft_m,
      engineType: boat.engine_type,
      fuelCapacityHours: boat.fuel_capacity_hours,
      avgSpeedKn: boat.avg_speed_kn,
    },
    profile: {
      experience: profile?.experience ?? null,
      crewMode: profile?.crew_mode ?? null,
      riskTolerance: profile?.risk_tolerance ?? null,
      nightSailing: profile?.night_sailing ?? null,
      maxContinuousHours: profile?.max_continuous_hours ?? null,
    },
    customDescription: description,
  })

  const response = await callClaude({
    systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Genere un itineraire personnalise de ${departure} a ${arrival} selon cette description: "${description}". Reponds en JSON.`,
      },
    ],
    model: MODEL_SONNET,
    maxTokens: 8192,
  })

  const parsed = extractJSON(response)

  if (!parsed.routes || parsed.routes.length === 0) {
    throw new Error('Claude n\'a genere aucun itineraire')
  }

  parsed.routes.forEach(validateRouteProposal)

  return parsed.routes.map(parseRouteProposal)
}
