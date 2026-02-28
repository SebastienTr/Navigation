// ── Open-Meteo Weather Client ─────────────────────────────────────────────
// Free marine + weather forecast API. No API key required.
// Docs: https://open-meteo.com/en/docs/marine-weather-api

const MARINE_API_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const FORECAST_API_BASE = 'https://api.open-meteo.com/v1/forecast'
const AROME_API_BASE = 'https://api.open-meteo.com/v1/meteofrance'
const REQUEST_TIMEOUT_MS = 10_000
const ENHANCED_TIMEOUT_MS = 8_000

// ── Types (legacy — dashboard) ────────────────────────────────────────────

export interface MarineHourly {
  time: string[]
  wave_height: number[]
  wave_direction: number[]
  wave_period: number[]
  wind_wave_height: number[]
  swell_wave_height: number[]
  swell_wave_period: number[]
}

export interface MarineDaily {
  time: string[]
  wave_height_max: number[]
  wave_period_max: number[]
}

export interface MarineWeatherData {
  latitude: number
  longitude: number
  timezone: string
  hourly: MarineHourly
  daily: MarineDaily
}

export interface ForecastHourly {
  time: string[]
  wind_speed_10m: number[]
  wind_direction_10m: number[]
  wind_gusts_10m: number[]
  visibility: number[]
  precipitation: number[]
  cloud_cover: number[]
  temperature_2m: number[]
}

export interface WeatherForecastData {
  latitude: number
  longitude: number
  timezone: string
  hourly: ForecastHourly
}

export interface CombinedWeatherData {
  marine: MarineWeatherData
  forecast: WeatherForecastData
  fetchedAt: string
}

// ── Types (enhanced — briefing/chat) ──────────────────────────────────────

export interface AromeHourly {
  time: string[]
  wind_speed_10m: number[]
  wind_direction_10m: number[]
  wind_gusts_10m: number[]
  precipitation: number[]
  cloud_cover: number[]
  pressure_msl: number[]
  temperature_2m: number[]
  visibility: number[]
}

export interface AromeData {
  latitude: number
  longitude: number
  hourly: AromeHourly
}

export interface EcmwfHourly {
  time: string[]
  wind_speed_10m: number[]
  wind_direction_10m: number[]
  wind_gusts_10m: number[]
  precipitation: number[]
  pressure_msl: number[]
  temperature_2m: number[]
}

export interface EcmwfData {
  latitude: number
  longitude: number
  hourly: EcmwfHourly
}

export interface EnhancedMarineHourly {
  time: string[]
  wave_height: number[]
  wave_direction: number[]
  wave_period: number[]
  wind_wave_height: number[]
  swell_wave_height: number[]
  swell_wave_direction: number[]
  swell_wave_period: number[]
  swell_wave_peak_period: number[]
  ocean_current_velocity: number[]
  ocean_current_direction: number[]
  sea_surface_temperature: number[]
}

export interface EnhancedMarineData {
  latitude: number
  longitude: number
  hourly: EnhancedMarineHourly
  daily: MarineDaily
}

export interface EnhancedWeatherData {
  arome: AromeData | null
  ecmwf: EcmwfData
  marine: EnhancedMarineData
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
        `Open-Meteo API error: ${response.status} ${response.statusText}`
      )
    }
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ── Marine Weather ────────────────────────────────────────────────────────

export async function getMarineWeather(
  lat: number,
  lon: number
): Promise<MarineWeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: [
      'wave_height',
      'wave_direction',
      'wave_period',
      'wind_wave_height',
      'swell_wave_height',
      'swell_wave_period',
    ].join(','),
    daily: ['wave_height_max', 'wave_period_max'].join(','),
    wind_speed_unit: 'kn',
    timezone: 'Europe/Paris',
  })

  const url = `${MARINE_API_BASE}?${params.toString()}`
  const response = await fetchWithTimeout(url)
  const data = (await response.json()) as MarineWeatherData

  return data
}

// ── Weather Forecast ──────────────────────────────────────────────────────

export async function getWeatherForecast(
  lat: number,
  lon: number
): Promise<WeatherForecastData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: [
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'visibility',
      'precipitation',
      'cloud_cover',
      'temperature_2m',
    ].join(','),
    wind_speed_unit: 'kn',
    timezone: 'Europe/Paris',
  })

  const url = `${FORECAST_API_BASE}?${params.toString()}`
  const response = await fetchWithTimeout(url)
  const data = (await response.json()) as WeatherForecastData

  return data
}

// ── Combined Weather (legacy — dashboard) ────────────────────────────────

export async function getCombinedWeather(
  lat: number,
  lon: number
): Promise<CombinedWeatherData> {
  const [marine, forecast] = await Promise.all([
    getMarineWeather(lat, lon),
    getWeatherForecast(lat, lon),
  ])

  return {
    marine,
    forecast,
    fetchedAt: new Date().toISOString(),
  }
}

// ── Enhanced Weather (briefing/chat) ──────────────────────────────────────

/** AROME France HD covers roughly metropolitan France */
function isInAromeCoverage(lat: number, lon: number): boolean {
  return lat >= 41 && lat <= 52 && lon >= -7 && lon <= 11
}

async function fetchArome(
  lat: number,
  lon: number
): Promise<AromeData | null> {
  if (!isInAromeCoverage(lat, lon)) return null

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    models: 'meteofrance_arome_france_hd',
    hourly: [
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
      'precipitation', 'cloud_cover', 'pressure_msl',
      'temperature_2m', 'visibility',
    ].join(','),
    wind_speed_unit: 'kn',
    timezone: 'Europe/Paris',
    forecast_days: '2',
  })

  const response = await fetchWithTimeout(
    `${AROME_API_BASE}?${params}`,
    ENHANCED_TIMEOUT_MS
  )
  return (await response.json()) as AromeData
}

async function fetchEcmwf(
  lat: number,
  lon: number
): Promise<EcmwfData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    models: 'ecmwf_ifs025',
    hourly: [
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
      'precipitation', 'pressure_msl', 'temperature_2m',
    ].join(','),
    wind_speed_unit: 'kn',
    timezone: 'Europe/Paris',
    forecast_days: '7',
  })

  const response = await fetchWithTimeout(
    `${FORECAST_API_BASE}?${params}`,
    ENHANCED_TIMEOUT_MS
  )
  return (await response.json()) as EcmwfData
}

async function fetchEnhancedMarine(
  lat: number,
  lon: number
): Promise<EnhancedMarineData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: [
      'wave_height', 'wave_direction', 'wave_period',
      'wind_wave_height', 'swell_wave_height', 'swell_wave_direction',
      'swell_wave_period', 'swell_wave_peak_period',
      'ocean_current_velocity', 'ocean_current_direction',
      'sea_surface_temperature',
    ].join(','),
    daily: ['wave_height_max', 'wave_period_max'].join(','),
    wind_speed_unit: 'kn',
    timezone: 'Europe/Paris',
  })

  const response = await fetchWithTimeout(
    `${MARINE_API_BASE}?${params}`,
    ENHANCED_TIMEOUT_MS
  )
  return (await response.json()) as EnhancedMarineData
}

/**
 * Fetch enhanced weather from 3 sources in parallel:
 * - AROME France HD (1.5 km, 0-48h) — null if outside France coverage
 * - ECMWF IFS (9 km, 0-7 days) — global
 * - Marine API (waves, swell, currents, SST)
 */
export async function getEnhancedWeather(
  lat: number,
  lon: number
): Promise<EnhancedWeatherData> {
  const [arome, ecmwf, marine] = await Promise.all([
    fetchArome(lat, lon).catch((err) => {
      console.warn('AROME fetch failed:', err)
      return null
    }),
    fetchEcmwf(lat, lon),
    fetchEnhancedMarine(lat, lon),
  ])

  return { arome, ecmwf, marine, fetchedAt: new Date().toISOString() }
}
