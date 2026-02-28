import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type VoyageRow = Database['public']['Tables']['voyages']['Row']
import {
  getBoat,
  getNavProfile,
  getVoyageBoatStatus,
  getVoyageLogs,
  getVoyageRouteSteps,
  getVoyageChecklist,
  getLatestBriefing,
  getVoyageChatHistory,
  getVoyageReminders,
  getVoyageMemory,
} from '@/lib/supabase/queries'
import type {
  BriefingContext,
  ChatContext,
  TriggerContext,
  WeatherData,
  TideData,
  BoatRow,
  NavProfileRow,
  MemoryDocs,
} from '@/types'
import { getEnhancedWeather } from '@/lib/weather/open-meteo'
import { buildWeatherSummary, buildTideSummary } from '@/lib/weather/summary'
import { getTides } from '@/lib/weather/worldtides'

type Client = SupabaseClient<Database>

// ── Helpers pour recuperer le bateau et profil du voyage ────────────────────

async function getVoyageBoatAndProfile(
  supabase: Client,
  userId: string,
  voyageId: string
): Promise<{ boat: BoatRow; profile: NavProfileRow | null }> {
  // Recuperer le voyage pour obtenir boat_id et nav_profile_id
  const { data: voyage, error } = await supabase
    .from('voyages')
    .select('*')
    .eq('id', voyageId)
    .eq('user_id', userId)
    .returns<VoyageRow[]>()
    .single()

  if (error || !voyage) {
    throw new Error(`Voyage introuvable (id: ${voyageId}, user: ${userId})`)
  }

  const boat = await getBoat(supabase, voyage.boat_id)
  if (!boat) {
    throw new Error(`Bateau introuvable (id: ${voyage.boat_id})`)
  }

  const profile = voyage.nav_profile_id
    ? await getNavProfile(supabase, voyage.nav_profile_id)
    : null

  return { boat, profile }
}

// ── Helper pour construire les MemoryDocs ──────────────────────────────────

async function fetchMemoryDocs(
  supabase: Client,
  voyageId: string
): Promise<MemoryDocs | null> {
  const rows = await getVoyageMemory(supabase, voyageId)
  if (rows.length === 0) return null

  const docs: MemoryDocs = { situation: '', boat: '', crew: '', preferences: '' }
  for (const row of rows) {
    if (row.slug in docs) {
      docs[row.slug] = row.content
    }
  }
  return docs
}

// ── Weather & Tide helpers ──────────────────────────────────────────────

function buildSourceUrls(lat: number, lon: number): string[] {
  return [
    `https://www.windy.com/${lat.toFixed(2)}/${lon.toFixed(2)}?wind,waves`,
    'https://marine.meteofrance.com/',
    'https://www.meteoconsult.fr/meteo-marine/bulletin-cotier',
    'https://marc.ifremer.fr/resultats/vagues/modeles_atlantique_nord_est',
  ]
}

async function fetchEnhancedWeatherData(
  lat: number,
  lon: number,
  label: string
): Promise<WeatherData | null> {
  try {
    const raw = await getEnhancedWeather(lat, lon)
    const summary = buildWeatherSummary(raw, label)
    const sourceUrls = buildSourceUrls(lat, lon)
    return { latitude: lat, longitude: lon, summary, sourceUrls }
  } catch (err) {
    console.warn('Enhanced weather fetch failed:', err)
    return null
  }
}

async function fetchTideData(
  lat: number,
  lon: number,
  label: string
): Promise<TideData | null> {
  try {
    const raw = await getTides(lat, lon)
    if (!raw) return null
    return { ...raw, summary: buildTideSummary(raw, label) }
  } catch {
    return null
  }
}

// ── Trouver l'etape en cours dans la route ─────────────────────────────────

function findCurrentStep(
  routeSteps: BriefingContext['routeSteps'],
  currentStepId: string | null
) {
  if (currentStepId) {
    return routeSteps.find((s) => s.id === currentStepId) ?? null
  }
  // Fallback: premiere etape "in_progress" ou premiere "to_do"
  return (
    routeSteps.find((s) => s.status === 'in_progress') ??
    routeSteps.find((s) => s.status === 'to_do') ??
    null
  )
}

// ── Build Briefing Context ─────────────────────────────────────────────────

export async function buildBriefingContext(
  supabase: Client,
  userId: string,
  voyageId: string
): Promise<BriefingContext> {
  // Requetes en parallele pour minimiser la latence
  const [
    { boat, profile },
    boatStatus,
    latestLogs,
    routeSteps,
    checklist,
    memory,
  ] = await Promise.all([
    getVoyageBoatAndProfile(supabase, userId, voyageId),
    getVoyageBoatStatus(supabase, voyageId),
    getVoyageLogs(supabase, voyageId, 10),
    getVoyageRouteSteps(supabase, voyageId),
    getVoyageChecklist(supabase, voyageId),
    fetchMemoryDocs(supabase, voyageId),
  ])

  const currentStep = findCurrentStep(routeSteps, boatStatus?.current_step_id ?? null)

  // Recuperer meteo et marees si on a une position
  let weather: WeatherData | null = null
  let weatherDestination: WeatherData | null = null
  let tides: TideData | null = null

  if (boatStatus?.current_lat && boatStatus?.current_lon) {
    const posLabel = boatStatus.current_position ?? `${boatStatus.current_lat.toFixed(2)}N, ${boatStatus.current_lon.toFixed(2)}E`

    const fetches: Promise<unknown>[] = [
      fetchEnhancedWeatherData(boatStatus.current_lat, boatStatus.current_lon, posLabel),
      fetchTideData(boatStatus.current_lat, boatStatus.current_lon, posLabel),
    ]

    // Fetch destination weather if current step has coordinates
    if (currentStep?.to_lat && currentStep?.to_lon) {
      fetches.push(
        fetchEnhancedWeatherData(currentStep.to_lat, currentStep.to_lon, currentStep.to_port ?? 'Destination')
      )
    }

    const results = await Promise.all(fetches)
    weather = results[0] as WeatherData | null
    tides = results[1] as TideData | null
    if (results[2]) weatherDestination = results[2] as WeatherData | null
  }

  return {
    boat,
    profile,
    boatStatus,
    latestLogs,
    routeSteps,
    currentStep,
    weather,
    weatherDestination,
    tides,
    checklist,
    memory,
    date: new Date().toISOString().split('T')[0],
  }
}

// ── Build Chat Context ─────────────────────────────────────────────────────

export async function buildChatContext(
  supabase: Client,
  userId: string,
  voyageId: string
): Promise<ChatContext> {
  const [
    { boat, profile },
    boatStatus,
    latestLogs,
    routeSteps,
    checklist,
    latestBriefing,
    recentChat,
    reminders,
    memory,
  ] = await Promise.all([
    getVoyageBoatAndProfile(supabase, userId, voyageId),
    getVoyageBoatStatus(supabase, voyageId),
    getVoyageLogs(supabase, voyageId, 5),
    getVoyageRouteSteps(supabase, voyageId),
    getVoyageChecklist(supabase, voyageId),
    getLatestBriefing(supabase, voyageId),
    getVoyageChatHistory(supabase, voyageId, 20),
    getVoyageReminders(supabase, voyageId, 10),
    fetchMemoryDocs(supabase, voyageId),
  ])

  const currentStep = findCurrentStep(routeSteps, boatStatus?.current_step_id ?? null)

  // Recuperer meteo et marees si on a une position
  let weather: WeatherData | null = null
  let weatherDestination: WeatherData | null = null
  let tides: TideData | null = null

  if (boatStatus?.current_lat && boatStatus?.current_lon) {
    const posLabel = boatStatus.current_position ?? `${boatStatus.current_lat.toFixed(2)}N, ${boatStatus.current_lon.toFixed(2)}E`

    const fetches: Promise<unknown>[] = [
      fetchEnhancedWeatherData(boatStatus.current_lat, boatStatus.current_lon, posLabel),
      fetchTideData(boatStatus.current_lat, boatStatus.current_lon, posLabel),
    ]

    if (currentStep?.to_lat && currentStep?.to_lon) {
      fetches.push(
        fetchEnhancedWeatherData(currentStep.to_lat, currentStep.to_lon, currentStep.to_port ?? 'Destination')
      )
    }

    const results = await Promise.all(fetches)
    weather = results[0] as WeatherData | null
    tides = results[1] as TideData | null
    if (results[2]) weatherDestination = results[2] as WeatherData | null
  }

  return {
    boat,
    profile,
    boatStatus,
    latestLogs,
    routeSteps,
    currentStep,
    weather,
    weatherDestination,
    tides,
    checklist,
    latestBriefing,
    recentChat,
    reminders,
    memory,
    date: new Date().toISOString().split('T')[0],
  }
}

// ── Build Trigger Context ──────────────────────────────────────────────────

export async function buildTriggerContext(
  supabase: Client,
  userId: string,
  voyageId: string
): Promise<TriggerContext> {
  // Recuperer le voyage pour obtenir boat_id
  const { data: voyage, error } = await supabase
    .from('voyages')
    .select('*')
    .eq('id', voyageId)
    .eq('user_id', userId)
    .returns<VoyageRow[]>()
    .single()

  if (error || !voyage) {
    throw new Error(`Voyage introuvable (id: ${voyageId}, user: ${userId})`)
  }

  const [
    boat,
    boatStatus,
    latestLogs,
    latestBriefing,
    checklist,
    routeSteps,
    memory,
  ] = await Promise.all([
    getBoat(supabase, voyage.boat_id),
    getVoyageBoatStatus(supabase, voyageId),
    getVoyageLogs(supabase, voyageId, 5),
    getLatestBriefing(supabase, voyageId),
    getVoyageChecklist(supabase, voyageId),
    getVoyageRouteSteps(supabase, voyageId),
    fetchMemoryDocs(supabase, voyageId),
  ])

  if (!boat) {
    throw new Error(`Bateau introuvable (id: ${voyage.boat_id})`)
  }

  return {
    boat,
    boatStatus,
    latestLogs,
    latestBriefing,
    checklist,
    routeSteps,
    memory,
    date: new Date().toISOString().split('T')[0],
  }
}
