// ── Weather & Tide Summary Builder ────────────────────────────────────────
// Transforms raw hourly data into structured text for AI prompt injection.

import type { EnhancedWeatherData } from './open-meteo'
import type { TideData } from './worldtides'

// ── Helpers ───────────────────────────────────────────────────────────────

const DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'] as const

function degreesToCompass(deg: number): string {
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16
  return DIRECTIONS[idx]
}

function findNowIndex(times: string[]): number {
  const now = new Date()
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - now.getTime())
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

function val(arr: number[] | undefined, idx: number): number | null {
  if (!arr || idx < 0 || idx >= arr.length) return null
  const v = arr[idx]
  return v != null && !isNaN(v) ? v : null
}

function rangeStr(arr: number[], from: number, to: number): string {
  const slice = arr.slice(from, to + 1).filter((v) => v != null && !isNaN(v))
  if (slice.length === 0) return '?'
  const min = Math.round(Math.min(...slice))
  const max = Math.round(Math.max(...slice))
  return min === max ? `${min}` : `${min}-${max}`
}

function maxVal(arr: number[], from: number, to: number): number | null {
  const slice = arr.slice(from, to + 1).filter((v) => v != null && !isNaN(v))
  return slice.length > 0 ? Math.max(...slice) : null
}

function maxValIndex(arr: number[], from: number, to: number): number {
  let maxI = from
  let maxV = -Infinity
  for (let i = from; i <= to && i < arr.length; i++) {
    if (arr[i] != null && arr[i] > maxV) {
      maxV = arr[i]
      maxI = i
    }
  }
  return maxI
}

function pressureTrend(arr: number[], nowIdx: number): string {
  const prev = val(arr, nowIdx - 3)
  const now = val(arr, nowIdx)
  if (prev == null || now == null) return ''
  const diff = now - prev
  if (diff > 2) return ' (hausse)'
  if (diff < -2) return ' (baisse)'
  return ' (stable)'
}

function hhmm(isoTime: string): string {
  const d = new Date(isoTime)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

function totalPrecip(arr: number[], from: number, to: number): number {
  let sum = 0
  for (let i = from; i <= to && i < arr.length; i++) {
    if (arr[i] != null && !isNaN(arr[i])) sum += arr[i]
  }
  return Math.round(sum * 10) / 10
}

function precipWindow(arr: number[], times: string[], from: number, to: number): string {
  let start = -1
  let end = -1
  for (let i = from; i <= to && i < arr.length; i++) {
    if (arr[i] > 0.1) {
      if (start === -1) start = i
      end = i
    }
  }
  if (start === -1) return ''
  return ` entre ${hhmm(times[start])}-${hhmm(times[end])}`
}

// ── Main builders ─────────────────────────────────────────────────────────

export function buildWeatherSummary(
  data: EnhancedWeatherData,
  label: string
): string {
  const { arome, ecmwf, marine } = data
  const lines: string[] = []

  // Pick the best short-term source
  const shortTerm = arome ?? ecmwf
  const models = arome
    ? 'AROME France HD (1.5 km) + ECMWF IFS (9 km)'
    : 'ECMWF IFS (9 km) — AROME indisponible hors couverture France'

  const lat = ecmwf.latitude
  const lon = ecmwf.longitude

  lines.push(`=== METEO — ${label.toUpperCase()} (${lat.toFixed(2)}N, ${lon.toFixed(2)}E) ===`)
  lines.push(`Modeles: ${models}`)
  lines.push(`Releve: ${new Date(data.fetchedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
  lines.push('')

  // ── Current conditions ──
  const stNow = findNowIndex(shortTerm.hourly.time)
  const mNow = findNowIndex(marine.hourly.time)

  const windNow = val(shortTerm.hourly.wind_speed_10m, stNow)
  const windDirNow = val(shortTerm.hourly.wind_direction_10m, stNow)
  const gustsNow = val(shortTerm.hourly.wind_gusts_10m, stNow)
  const pressureNow = val(shortTerm.hourly.pressure_msl, stNow)
  const waveNow = val(marine.hourly.wave_height, mNow)
  const wavePeriodNow = val(marine.hourly.wave_period, mNow)
  const swellNow = val(marine.hourly.swell_wave_height, mNow)
  const swellDirNow = val(marine.hourly.swell_wave_direction, mNow)
  const currentVel = val(marine.hourly.ocean_current_velocity, mNow)
  const currentDir = val(marine.hourly.ocean_current_direction, mNow)
  const sst = val(marine.hourly.sea_surface_temperature, mNow)

  lines.push('--- CONDITIONS ACTUELLES ---')

  if (windNow != null && windDirNow != null) {
    const gustStr = gustsNow != null ? ` — rafales ${Math.round(gustsNow)} kn` : ''
    lines.push(`Vent: ${Math.round(windNow)} kn ${degreesToCompass(windDirNow)} (${Math.round(windDirNow)}°)${gustStr}`)
  }

  if (pressureNow != null) {
    lines.push(`Pression: ${Math.round(pressureNow)} hPa${pressureTrend(shortTerm.hourly.pressure_msl, stNow)}`)
  }

  if (waveNow != null && wavePeriodNow != null) {
    const swellStr = swellNow != null && swellDirNow != null
      ? ` — houle ${swellNow.toFixed(1)} m de ${degreesToCompass(swellDirNow)}`
      : ''
    lines.push(`Vagues: ${waveNow.toFixed(1)} m / ${Math.round(wavePeriodNow)}s${swellStr}`)
  }

  if (currentVel != null && currentDir != null && currentVel > 0.05) {
    lines.push(`Courant: ${currentVel.toFixed(1)} kn vers ${degreesToCompass(currentDir)}`)
  }

  const extras: string[] = []
  if (sst != null) extras.push(`Temp mer: ${Math.round(sst)}°C`)
  if (arome) {
    const vis = val(arome.hourly.visibility, stNow)
    if (vis != null) extras.push(`Visibilite: ${vis >= 1000 ? `${Math.round(vis / 1000)} km` : `${Math.round(vis)} m`}`)
  }
  if (extras.length > 0) lines.push(extras.join(' | '))

  lines.push('')

  // ── Today ──
  // Find today's range in short-term arrays
  const todayStr = new Date().toISOString().split('T')[0]
  const stTimes = shortTerm.hourly.time
  const mTimes = marine.hourly.time

  let stTodayStart = stTimes.findIndex((t) => t.startsWith(todayStr) && t.includes('T06'))
  if (stTodayStart === -1) stTodayStart = stNow
  let stTodayEnd = stTimes.findIndex((t) => t.startsWith(todayStr) && t.includes('T23'))
  if (stTodayEnd === -1) stTodayEnd = Math.min(stTodayStart + 17, stTimes.length - 1)

  // Morning / afternoon split
  const stMidIdx = stTimes.findIndex((t) => t.startsWith(todayStr) && t.includes('T12'))
  const stMorningEnd = stMidIdx > 0 ? stMidIdx - 1 : stTodayStart + 5
  const stAfternoonStart = stMidIdx > 0 ? stMidIdx : stTodayStart + 6

  lines.push('--- AUJOURD\'HUI ---')

  const windDir06 = val(shortTerm.hourly.wind_direction_10m, stTodayStart)
  const windDir18 = val(shortTerm.hourly.wind_direction_10m, stAfternoonStart)

  const morningWind = rangeStr(shortTerm.hourly.wind_speed_10m, stTodayStart, stMorningEnd)
  const morningDir = windDir06 != null ? degreesToCompass(windDir06) : '?'
  const afternoonWind = rangeStr(shortTerm.hourly.wind_speed_10m, stAfternoonStart, stTodayEnd)
  const afternoonDir = windDir18 != null ? degreesToCompass(windDir18) : '?'

  lines.push(`Matin (06-12h): ${morningWind} kn ${morningDir} → Apres-midi: ${afternoonWind} kn ${afternoonDir}`)

  const gustMax = maxVal(shortTerm.hourly.wind_gusts_10m, stTodayStart, stTodayEnd)
  if (gustMax != null) {
    const gustMaxIdx = maxValIndex(shortTerm.hourly.wind_gusts_10m, stTodayStart, stTodayEnd)
    lines.push(`Rafales max: ${Math.round(gustMax)} kn vers ${hhmm(stTimes[gustMaxIdx])}`)
  }

  const precip = totalPrecip(shortTerm.hourly.precipitation, stTodayStart, stTodayEnd)
  if (precip > 0) {
    const window = precipWindow(shortTerm.hourly.precipitation, stTimes, stTodayStart, stTodayEnd)
    lines.push(`Pluie: ${precip}mm${window}`)
  } else {
    lines.push('Pluie: aucune')
  }

  // Marine today
  let mTodayStart = mTimes.findIndex((t) => t.startsWith(todayStr) && t.includes('T06'))
  if (mTodayStart === -1) mTodayStart = mNow
  let mTodayEnd = mTimes.findIndex((t) => t.startsWith(todayStr) && t.includes('T23'))
  if (mTodayEnd === -1) mTodayEnd = Math.min(mTodayStart + 17, mTimes.length - 1)

  const waveMax = maxVal(marine.hourly.wave_height, mTodayStart, mTodayEnd)
  const wavePMax = maxVal(marine.hourly.wave_period, mTodayStart, mTodayEnd)
  if (waveMax != null) {
    const waveMaxIdx = maxValIndex(marine.hourly.wave_height, mTodayStart, mTodayEnd)
    const periodStr = wavePMax != null ? ` / ${Math.round(wavePMax)}s` : ''
    lines.push(`Vagues max: ${waveMax.toFixed(1)} m${periodStr} vers ${hhmm(mTimes[waveMaxIdx])}`)
  }

  lines.push('')

  // ── Tomorrow ──
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  lines.push('--- DEMAIN ---')

  if (arome) {
    const aTmStart = arome.hourly.time.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T06'))
    const aTmEnd = arome.hourly.time.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T18'))
    if (aTmStart >= 0 && aTmEnd >= 0) {
      const aWind = rangeStr(arome.hourly.wind_speed_10m, aTmStart, aTmEnd)
      const aDir = val(arome.hourly.wind_direction_10m, aTmStart)
      const aDirStr = aDir != null ? degreesToCompass(aDir) : '?'

      // Marine tomorrow
      const mTmStart = mTimes.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T06'))
      const mTmEnd = mTimes.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T18'))
      const mWaveRange = mTmStart >= 0 && mTmEnd >= 0
        ? rangeStr(marine.hourly.wave_height, mTmStart, mTmEnd)
        : '?'

      lines.push(`AROME: ${aWind} kn ${aDirStr} — vagues ${mWaveRange} m`)
    }
  }

  // ECMWF tomorrow
  const eTmStart = ecmwf.hourly.time.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T06'))
  const eTmEnd = ecmwf.hourly.time.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T18'))
  if (eTmStart >= 0 && eTmEnd >= 0) {
    const eWind = rangeStr(ecmwf.hourly.wind_speed_10m, eTmStart, eTmEnd)
    const eDir = val(ecmwf.hourly.wind_direction_10m, eTmStart)
    const eDirStr = eDir != null ? degreesToCompass(eDir) : '?'

    const mTmStart = mTimes.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T06'))
    const mTmEnd = mTimes.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T18'))
    const mWaveRange = mTmStart >= 0 && mTmEnd >= 0
      ? rangeStr(marine.hourly.wave_height, mTmStart, mTmEnd)
      : '?'

    lines.push(`ECMWF: ${eWind} kn ${eDirStr} — vagues ${mWaveRange} m`)
  }

  // Model divergence check (AROME vs ECMWF tomorrow)
  if (arome && eTmStart >= 0 && eTmEnd >= 0) {
    const aTmStart2 = arome.hourly.time.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T06'))
    const aTmEnd2 = arome.hourly.time.findIndex((t) => t.startsWith(tomorrowStr) && t.includes('T18'))
    if (aTmStart2 >= 0 && aTmEnd2 >= 0) {
      const aMax = maxVal(arome.hourly.wind_speed_10m, aTmStart2, aTmEnd2)
      const eMax = maxVal(ecmwf.hourly.wind_speed_10m, eTmStart, eTmEnd)
      if (aMax != null && eMax != null) {
        const diff = Math.abs(aMax - eMax)
        if (diff >= 5) {
          lines.push(`⚠ Ecart modeles: ${Math.round(diff)} kn → incertitude ${diff >= 10 ? 'forte' : 'moderee'}`)
        }
      }
    }
  }

  lines.push('')

  // ── 3-7 day trend (ECMWF only) ──
  lines.push('--- TENDANCE 3-7 JOURS (ECMWF) ---')
  for (let d = 2; d <= 6; d++) {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + d)
    const dateStr = futureDate.toISOString().split('T')[0]

    const eStart = ecmwf.hourly.time.findIndex((t) => t.startsWith(dateStr) && t.includes('T06'))
    const eEnd = ecmwf.hourly.time.findIndex((t) => t.startsWith(dateStr) && t.includes('T18'))
    if (eStart < 0 || eEnd < 0) continue

    const windRange = rangeStr(ecmwf.hourly.wind_speed_10m, eStart, eEnd)
    const dir = val(ecmwf.hourly.wind_direction_10m, eStart)
    const dirStr = dir != null ? degreesToCompass(dir) : '?'

    const mStart = mTimes.findIndex((t) => t.startsWith(dateStr) && t.includes('T06'))
    const mEnd = mTimes.findIndex((t) => t.startsWith(dateStr) && t.includes('T18'))
    const waveRange = mStart >= 0 && mEnd >= 0
      ? ` — ${rangeStr(marine.hourly.wave_height, mStart, mEnd)} m`
      : ''

    lines.push(`J+${d}: ${windRange} kn ${dirStr}${waveRange}`)
  }

  return lines.join('\n')
}

// ── Tide summary ──────────────────────────────────────────────────────────

export function buildTideSummary(tides: TideData, label: string): string {
  const lines: string[] = []
  lines.push(`=== MAREES — ${label.toUpperCase()} ===`)

  if (tides.station) {
    lines.push(`Station: ${tides.station}`)
  }

  // Filter future extremes
  const now = Date.now()
  const upcoming = tides.extremes
    .filter((e) => new Date(e.date).getTime() > now - 3600_000)
    .slice(0, 6)

  if (upcoming.length === 0) {
    lines.push('Aucune donnee de maree disponible.')
    return lines.join('\n')
  }

  // Check if Mediterranean (very small tidal range)
  const heights = upcoming.map((e) => e.height)
  const range = Math.max(...heights) - Math.min(...heights)

  if (range < 0.3) {
    lines.push('Mediterranee : marnage negligeable, marees non pertinentes pour la navigation.')
    return lines.join('\n')
  }

  lines.push('Prochaines marees:')
  for (const e of upcoming) {
    const time = new Date(e.date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    })
    const typeStr = e.type === 'High' ? 'PM' : 'BM'
    lines.push(`  - ${typeStr} ${time} (${e.height.toFixed(1)} m)`)
  }

  lines.push(`Marnage: ${range.toFixed(1)} m${range > 3 ? ' — courants de maree significatifs' : ''}`)

  return lines.join('\n')
}
