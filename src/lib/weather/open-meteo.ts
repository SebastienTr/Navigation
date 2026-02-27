// ── Open-Meteo Weather Client ─────────────────────────────────────────────
// Free marine + weather forecast API. No API key required.
// Docs: https://open-meteo.com/en/docs/marine-weather-api

const MARINE_API_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const FORECAST_API_BASE = 'https://api.open-meteo.com/v1/forecast'
const REQUEST_TIMEOUT_MS = 10_000

// ── Types ─────────────────────────────────────────────────────────────────

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

// ── Combined Weather ──────────────────────────────────────────────────────

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
