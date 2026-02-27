import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

type Tables = Database['public']['Tables']
type UserRow = Tables['users']['Row']
type BoatRow = Tables['boats']['Row']
type NavProfileRow = Tables['nav_profiles']['Row']
type VoyageRow = Tables['voyages']['Row']
type BoatStatusRow = Tables['boat_status']['Row']
type RouteStepRow = Tables['route_steps']['Row']
type BriefingRow = Tables['briefings']['Row']
type LogRow = Tables['logs']['Row']
type ChecklistRow = Tables['checklist']['Row']
type ChatHistoryRow = Tables['chat_history']['Row']

type Client = SupabaseClient<Database>

// ── Users ──────────────────────────────────────────────────────────────

export async function getUserProfile(
  supabase: Client,
  userId: string
): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .returns<UserRow[]>()
    .single()

  if (error) throw error
  return data
}

// ── Boats ──────────────────────────────────────────────────────────────

export async function getUserBoats(
  supabase: Client,
  userId: string
): Promise<BoatRow[]> {
  const { data, error } = await supabase
    .from('boats')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<BoatRow[]>()

  if (error) throw error
  return data ?? []
}

export async function getBoat(
  supabase: Client,
  boatId: string
): Promise<BoatRow | null> {
  const { data, error } = await supabase
    .from('boats')
    .select('*')
    .eq('id', boatId)
    .returns<BoatRow[]>()
    .single()

  if (error) throw error
  return data
}

// ── Nav Profiles ───────────────────────────────────────────────────────

export async function getNavProfiles(
  supabase: Client,
  userId: string
): Promise<NavProfileRow[]> {
  const { data, error } = await supabase
    .from('nav_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<NavProfileRow[]>()

  if (error) throw error
  return data ?? []
}

export async function getNavProfile(
  supabase: Client,
  profileId: string
): Promise<NavProfileRow | null> {
  const { data, error } = await supabase
    .from('nav_profiles')
    .select('*')
    .eq('id', profileId)
    .returns<NavProfileRow[]>()
    .single()

  if (error) throw error
  return data
}

// ── Voyages ────────────────────────────────────────────────────────────

export async function getUserVoyages(
  supabase: Client,
  userId: string
): Promise<VoyageRow[]> {
  const { data, error } = await supabase
    .from('voyages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .returns<VoyageRow[]>()

  if (error) throw error
  return data ?? []
}

export async function getActiveVoyage(
  supabase: Client,
  userId: string
): Promise<VoyageRow | null> {
  const { data, error } = await supabase
    .from('voyages')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .returns<VoyageRow[]>()
    .maybeSingle()

  if (error) throw error
  return data
}

// ── Boat Status ────────────────────────────────────────────────────────

export async function getVoyageBoatStatus(
  supabase: Client,
  voyageId: string
): Promise<BoatStatusRow | null> {
  const { data, error } = await supabase
    .from('boat_status')
    .select('*')
    .eq('voyage_id', voyageId)
    .returns<BoatStatusRow[]>()
    .single()

  if (error) throw error
  return data
}

// ── Route Steps ────────────────────────────────────────────────────────

export async function getVoyageRouteSteps(
  supabase: Client,
  voyageId: string
): Promise<RouteStepRow[]> {
  const { data, error } = await supabase
    .from('route_steps')
    .select('*')
    .eq('voyage_id', voyageId)
    .order('order_num', { ascending: true })
    .returns<RouteStepRow[]>()

  if (error) throw error
  return data ?? []
}

// ── Briefings ──────────────────────────────────────────────────────────

export async function getVoyageBriefings(
  supabase: Client,
  voyageId: string,
  limit: number = 20
): Promise<BriefingRow[]> {
  const { data, error } = await supabase
    .from('briefings')
    .select('*')
    .eq('voyage_id', voyageId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<BriefingRow[]>()

  if (error) throw error
  return data ?? []
}

export async function getLatestBriefing(
  supabase: Client,
  voyageId: string
): Promise<BriefingRow | null> {
  const { data, error } = await supabase
    .from('briefings')
    .select('*')
    .eq('voyage_id', voyageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<BriefingRow[]>()
    .maybeSingle()

  if (error) throw error
  return data
}

// ── Logs ───────────────────────────────────────────────────────────────

export async function getVoyageLogs(
  supabase: Client,
  voyageId: string,
  limit: number = 50
): Promise<LogRow[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .eq('voyage_id', voyageId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<LogRow[]>()

  if (error) throw error
  return data ?? []
}

export async function getLatestLog(
  supabase: Client,
  voyageId: string
): Promise<LogRow | null> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .eq('voyage_id', voyageId)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<LogRow[]>()
    .maybeSingle()

  if (error) throw error
  return data
}

// ── Checklist ──────────────────────────────────────────────────────────

export async function getVoyageChecklist(
  supabase: Client,
  voyageId: string
): Promise<ChecklistRow[]> {
  const { data, error } = await supabase
    .from('checklist')
    .select('*')
    .eq('voyage_id', voyageId)
    .order('priority', { ascending: true })
    .returns<ChecklistRow[]>()

  if (error) throw error
  return data ?? []
}

// ── Chat History ───────────────────────────────────────────────────────

export async function getVoyageChatHistory(
  supabase: Client,
  voyageId: string,
  limit: number = 50
): Promise<ChatHistoryRow[]> {
  const { data, error } = await supabase
    .from('chat_history')
    .select('*')
    .eq('voyage_id', voyageId)
    .order('created_at', { ascending: true })
    .limit(limit)
    .returns<ChatHistoryRow[]>()

  if (error) throw error
  return data ?? []
}
