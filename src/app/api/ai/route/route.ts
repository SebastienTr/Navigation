import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { MODEL_SONNET } from '@/lib/ai/proxy'
import { buildRouteSystemPrompt } from '@/lib/ai/prompts'
import { getUserBoats, getNavProfiles } from '@/lib/supabase/queries'

interface BoatPayload {
  name?: string
  type?: string
  length_m?: number | null
  draft_m?: number | null
  air_draft_m?: number | null
  engine_type?: string | null
  fuel_capacity_hours?: number | null
  avg_speed_kn?: number | null
}

interface ProfilePayload {
  experience?: string | null
  crew_mode?: string | null
  risk_tolerance?: string | null
  night_sailing?: string | null
  max_continuous_hours?: number | null
}

interface RouteRequestBody {
  departure?: string
  arrival?: string
  departure_port?: string
  arrival_port?: string
  description?: string
  custom_description?: string
  boat?: BoatPayload
  profile?: ProfilePayload
}

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

function extractJSON(text: string): { routes: RawRouteProposal[] } {
  try {
    return JSON.parse(text)
  } catch { /* continue */ }

  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonBlockMatch?.[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1])
    } catch { /* continue */ }
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1))
  }

  throw new Error('Aucun JSON valide trouvé dans la réponse de Claude')
}

// ── Singleton Anthropic client ────────────────────────────────────────────
let clientInstance: Anthropic | null = null
function getClient(): Anthropic {
  if (!clientInstance) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquant')
    clientInstance = new Anthropic({ apiKey })
  }
  return clientInstance
}

// Allow up to 5 minutes for AI route generation (complex multi-step routes)
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié. Veuillez vous connecter.' },
        { status: 401 }
      )
    }

    const body = (await request.json()) as RouteRequestBody
    const departure = body.departure || body.departure_port
    const arrival = body.arrival || body.arrival_port
    const description = body.description || body.custom_description

    if (!departure || typeof departure !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "departure" (port de départ) est requis.' },
        { status: 400 }
      )
    }

    if (!arrival || typeof arrival !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "arrival" (port d\'arrivée) est requis.' },
        { status: 400 }
      )
    }

    // Get boat/profile from body (onboarding) or DB (settings)
    let boatInfo: {
      name: string
      type: string | null
      lengthM: number | null
      draftM: number | null
      airDraftM: number | null
      engineType: string | null
      fuelCapacityHours: number | null
      avgSpeedKn: number | null
    }
    let profileInfo: {
      experience: string | null
      crewMode: string | null
      riskTolerance: string | null
      nightSailing: string | null
      maxContinuousHours: number | null
    }

    if (body.boat?.name) {
      boatInfo = {
        name: body.boat.name || 'Bateau',
        type: body.boat.type || null,
        lengthM: body.boat.length_m ?? null,
        draftM: body.boat.draft_m ?? null,
        airDraftM: body.boat.air_draft_m ?? null,
        engineType: body.boat.engine_type ?? null,
        fuelCapacityHours: body.boat.fuel_capacity_hours ?? null,
        avgSpeedKn: body.boat.avg_speed_kn ?? null,
      }
      profileInfo = {
        experience: body.profile?.experience ?? null,
        crewMode: body.profile?.crew_mode ?? null,
        riskTolerance: body.profile?.risk_tolerance ?? null,
        nightSailing: body.profile?.night_sailing ?? null,
        maxContinuousHours: body.profile?.max_continuous_hours ?? null,
      }
    } else {
      const [boats, profiles] = await Promise.all([
        getUserBoats(supabase, user.id),
        getNavProfiles(supabase, user.id),
      ])
      const boat = boats[0]
      if (!boat) {
        return NextResponse.json(
          { error: 'Aucun bateau configuré. Renseignez les données du bateau.' },
          { status: 400 }
        )
      }
      const profile = profiles[0]
      boatInfo = {
        name: boat.name,
        type: boat.type,
        lengthM: boat.length_m,
        draftM: boat.draft_m,
        airDraftM: boat.air_draft_m,
        engineType: boat.engine_type,
        fuelCapacityHours: boat.fuel_capacity_hours,
        avgSpeedKn: boat.avg_speed_kn,
      }
      profileInfo = {
        experience: profile?.experience ?? null,
        crewMode: profile?.crew_mode ?? null,
        riskTolerance: profile?.risk_tolerance ?? null,
        nightSailing: profile?.night_sailing ?? null,
        maxContinuousHours: profile?.max_continuous_hours ?? null,
      }
    }

    const systemPrompt = buildRouteSystemPrompt({
      departure: departure.trim(),
      arrival: arrival.trim(),
      boat: boatInfo,
      profile: profileInfo,
      customDescription: description?.trim(),
    })

    const userMessage = description
      ? `Génère un itinéraire personnalisé de ${departure} à ${arrival} selon cette description: "${description}". Réponds en JSON.`
      : `Propose 2 à 3 itinéraires pour un convoyage de ${departure} à ${arrival}. Réponds en JSON.`

    // Stream via SSE
    const encoder = new TextEncoder()
    const client = getClient()

    const sseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let accumulated = ''
        try {
          const stream = client.messages.stream({
            model: MODEL_SONNET,
            max_tokens: 16384,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          })

          stream.on('text', (text) => {
            accumulated += text
            const sseEvent = `data: ${JSON.stringify({ type: 'text_delta', text })}\n\n`
            controller.enqueue(encoder.encode(sseEvent))
          })

          await stream.finalMessage()

          // Parse accumulated JSON and send done event with routes
          const parsed = extractJSON(accumulated)

          if (!parsed.routes || parsed.routes.length === 0) {
            throw new Error('Claude n\'a proposé aucun itinéraire')
          }

          const options = parsed.routes.map((route, index) => ({
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
              distance_nm: s.distance_nm,
              distance_km: s.distance_km,
              phase: s.phase,
              notes: s.notes,
              from_lat: s.from_lat,
              from_lon: s.from_lon,
              to_lat: s.to_lat,
              to_lon: s.to_lon,
            })),
          }))

          const doneEvent = `data: ${JSON.stringify({ type: 'done', routes: parsed.routes, options })}\n\n`
          controller.enqueue(encoder.encode(doneEvent))
          controller.close()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue'
          const errorEvent = `data: ${JSON.stringify({ type: 'error', error: message })}\n\n`
          controller.enqueue(encoder.encode(errorEvent))
          controller.close()
        }
      },
    })

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('AI route generation error:', error)

    const message =
      error instanceof Error ? error.message : 'Erreur interne du serveur'

    return NextResponse.json(
      { error: `Erreur lors de la génération de route : ${message}` },
      { status: 500 }
    )
  }
}
