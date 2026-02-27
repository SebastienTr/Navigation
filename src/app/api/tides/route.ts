import { NextRequest, NextResponse } from 'next/server'
import { getTides } from '@/lib/weather/worldtides'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const latStr = searchParams.get('lat')
    const lonStr = searchParams.get('lon')
    const daysStr = searchParams.get('days')

    if (!latStr || !lonStr) {
      return NextResponse.json(
        { error: 'Les paramètres lat et lon sont requis.' },
        { status: 400 }
      )
    }

    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json(
        { error: 'Les paramètres lat et lon doivent être des nombres valides.' },
        { status: 400 }
      )
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { error: 'Coordonnées hors limites (lat: -90 à 90, lon: -180 à 180).' },
        { status: 400 }
      )
    }

    const days = daysStr ? parseInt(daysStr, 10) : 3

    if (isNaN(days) || days < 1 || days > 7) {
      return NextResponse.json(
        { error: 'Le paramètre days doit être un entier entre 1 et 7.' },
        { status: 400 }
      )
    }

    const tides = await getTides(lat, lon, days)

    if (tides === null) {
      return NextResponse.json(
        { error: 'Données de marées indisponibles (clé API WorldTides non configurée).' },
        { status: 503 }
      )
    }

    return NextResponse.json(tides, {
      headers: {
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=10800',
      },
    })
  } catch (error) {
    console.error('Tides API error:', error)

    const message =
      error instanceof Error ? error.message : 'Erreur interne du serveur'

    return NextResponse.json(
      { error: `Impossible de récupérer les marées: ${message}` },
      { status: 500 }
    )
  }
}
