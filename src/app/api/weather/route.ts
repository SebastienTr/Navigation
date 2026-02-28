import { NextRequest, NextResponse } from 'next/server'
import { getCombinedWeather, getEnhancedWeather } from '@/lib/weather/open-meteo'
import { log } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const timer = log.timed('weather', 'Weather fetch')
  try {
    const { searchParams } = request.nextUrl
    const latStr = searchParams.get('lat')
    const lonStr = searchParams.get('lon')
    const mode = searchParams.get('mode') ?? 'raw'

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

    const weather = mode === 'enhanced'
      ? await getEnhancedWeather(lat, lon)
      : await getCombinedWeather(lat, lon)

    timer.end({ lat, lon, mode })

    return NextResponse.json(weather, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
      },
    })
  } catch (error) {
    timer.error(error)

    const message =
      error instanceof Error ? error.message : 'Erreur interne du serveur'

    return NextResponse.json(
      { error: `Impossible de récupérer la météo: ${message}` },
      { status: 500 }
    )
  }
}
