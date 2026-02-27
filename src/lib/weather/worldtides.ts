// ── WorldTides Client ─────────────────────────────────────────────────────
// Tidal predictions via WorldTides API v3.
// Requires WORLDTIDES_API_KEY environment variable.
// Docs: https://www.worldtides.info/apidocs

const WORLDTIDES_API_BASE = 'https://www.worldtides.info/api/v3'
const REQUEST_TIMEOUT_MS = 10_000

// ── Types ─────────────────────────────────────────────────────────────────

export interface TideHeight {
  /** Unix timestamp (seconds) */
  dt: number
  /** ISO date string */
  date: string
  /** Tide height in meters */
  height: number
}

export interface TideExtreme {
  /** Unix timestamp (seconds) */
  dt: number
  /** ISO date string */
  date: string
  /** Tide height in meters */
  height: number
  /** "High" or "Low" */
  type: 'High' | 'Low'
}

export interface TideData {
  /** Station or location latitude */
  latitude: number
  /** Station or location longitude */
  longitude: number
  /** Tidal heights at regular intervals */
  heights: TideHeight[]
  /** High and low tide extremes */
  extremes: TideExtreme[]
  /** Name of the reference station (if available) */
  station: string | null
  /** Timestamp when data was fetched */
  fetchedAt: string
}

// ── Fetch helper with timeout ─────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(
        `WorldTides API error: ${response.status} ${response.statusText}`
      )
    }
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ── Raw API response shape ────────────────────────────────────────────────

interface WorldTidesResponse {
  status: number
  callCount: number
  copyright: string
  requestLat: number
  requestLon: number
  responseLat: number
  responseLon: number
  atlas: string
  station: string
  heights: Array<{
    dt: number
    date: string
    height: number
  }>
  extremes: Array<{
    dt: number
    date: string
    height: number
    type: string
  }>
}

// ── Get Tides ─────────────────────────────────────────────────────────────

/**
 * Fetch tide predictions (heights + extremes) for a given location.
 * Returns null if the WORLDTIDES_API_KEY is not configured.
 */
export async function getTides(
  lat: number,
  lon: number,
  days: number = 3
): Promise<TideData | null> {
  const apiKey = process.env.WORLDTIDES_API_KEY

  if (!apiKey) {
    console.warn(
      'WORLDTIDES_API_KEY is not set — tide data will not be available.'
    )
    return null
  }

  const params = new URLSearchParams({
    heights: '',
    extremes: '',
    lat: lat.toString(),
    lon: lon.toString(),
    key: apiKey,
    days: days.toString(),
  })

  const url = `${WORLDTIDES_API_BASE}?${params.toString()}`
  const response = await fetchWithTimeout(url)
  const raw = (await response.json()) as WorldTidesResponse

  if (raw.status !== 200) {
    throw new Error(`WorldTides API returned status ${raw.status}`)
  }

  return {
    latitude: raw.responseLat,
    longitude: raw.responseLon,
    station: raw.station || null,
    heights: raw.heights.map((h) => ({
      dt: h.dt,
      date: h.date,
      height: h.height,
    })),
    extremes: raw.extremes.map((e) => ({
      dt: e.dt,
      date: e.date,
      height: e.height,
      type: e.type as 'High' | 'Low',
    })),
    fetchedAt: new Date().toISOString(),
  }
}
