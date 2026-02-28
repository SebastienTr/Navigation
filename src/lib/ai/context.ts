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
  ReminderRow,
} from '@/types'

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

// ── Base URL pour les appels API internes ──────────────────────────────────

function getBaseUrl(): string {
  // En production Vercel, utiliser VERCEL_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  // Fallback sur le port Next.js par defaut
  return `http://localhost:${process.env.PORT ?? 3000}`
}

// ── Recuperation meteo via l'API interne ───────────────────────────────────

async function fetchWeather(
  lat: number,
  lon: number
): Promise<WeatherData | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
    })
    const response = await fetch(
      `${getBaseUrl()}/api/weather?${params}`,
      { next: { revalidate: 1800 } } // Cache 30 min
    )

    if (!response.ok) return null
    return (await response.json()) as WeatherData
  } catch {
    // Meteo indisponible — on continue sans
    return null
  }
}

// ── Recuperation marees via l'API interne ──────────────────────────────────

async function fetchTides(
  lat: number,
  lon: number
): Promise<TideData | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
    })
    const response = await fetch(
      `${getBaseUrl()}/api/tides?${params}`,
      { next: { revalidate: 3600 } } // Cache 1h
    )

    if (!response.ok) return null
    return (await response.json()) as TideData
  } catch {
    // Marees indisponibles — on continue sans
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
  let tides: TideData | null = null

  if (boatStatus?.current_lat && boatStatus?.current_lon) {
    const [weatherResult, tidesResult] = await Promise.all([
      fetchWeather(boatStatus.current_lat, boatStatus.current_lon),
      fetchTides(boatStatus.current_lat, boatStatus.current_lon),
    ])
    weather = weatherResult
    tides = tidesResult
  }

  return {
    boat,
    profile,
    boatStatus,
    latestLogs,
    routeSteps,
    currentStep,
    weather,
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
  let tides: TideData | null = null

  if (boatStatus?.current_lat && boatStatus?.current_lon) {
    const [weatherResult, tidesResult] = await Promise.all([
      fetchWeather(boatStatus.current_lat, boatStatus.current_lon),
      fetchTides(boatStatus.current_lat, boatStatus.current_lon),
    ])
    weather = weatherResult
    tides = tidesResult
  }

  return {
    boat,
    profile,
    boatStatus,
    latestLogs,
    routeSteps,
    currentStep,
    weather,
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
