import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateRouteProposals,
  generateCustomRoute,
} from '@/lib/ai/route'

interface RouteRequestBody {
  departure: string
  arrival: string
  /** Free-text description for custom "Other" route */
  description?: string
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user via Supabase session
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

    // Parse request body
    const body = (await request.json()) as RouteRequestBody

    if (!body.departure || typeof body.departure !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "departure" (port de départ) est requis.' },
        { status: 400 }
      )
    }

    if (!body.arrival || typeof body.arrival !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "arrival" (port d\'arrivée) est requis.' },
        { status: 400 }
      )
    }

    // Generate route proposals
    let routes

    if (body.description && body.description.trim().length > 0) {
      // Custom route from free-text description
      routes = await generateCustomRoute(
        supabase,
        user.id,
        body.departure.trim(),
        body.arrival.trim(),
        body.description.trim()
      )
    } else {
      // Standard 2-3 route proposals
      routes = await generateRouteProposals(
        supabase,
        user.id,
        body.departure.trim(),
        body.arrival.trim()
      )
    }

    return NextResponse.json({ routes })
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
