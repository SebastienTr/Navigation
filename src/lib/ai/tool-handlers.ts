// ── Handlers d'outils pour le chat agentique ────────────────────────────────
// Chaque handler exécute une mutation Supabase (ou lecture) et retourne un
// résumé texte que Claude peut interpréter pour sa réponse.
//
// Utilise le client admin Supabase (bypass RLS). L'authentification est
// vérifiée dans la route API avant d'arriver ici.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { ToolName } from './tools'

type AdminClient = SupabaseClient<Database>
type ChecklistRow = Database['public']['Tables']['checklist']['Row']
type RouteStepRow = Database['public']['Tables']['route_steps']['Row']

export interface ToolCallContext {
  supabase: AdminClient
  userId: string
  voyageId: string
}

export interface ToolCallResult {
  success: boolean
  summary: string
  data?: Record<string, unknown>
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: ToolCallContext
): Promise<ToolCallResult> {
  const handler = TOOL_HANDLERS[toolName as ToolName]
  if (!handler) {
    return { success: false, summary: `Outil inconnu: ${toolName}` }
  }

  try {
    return await handler(toolInput, context)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error(`Tool handler error [${toolName}]:`, message)
    return { success: false, summary: `Erreur lors de l'exécution de ${toolName}: ${message}` }
  }
}

// ── Handler map ──────────────────────────────────────────────────────────────

const TOOL_HANDLERS: Record<
  ToolName,
  (input: Record<string, unknown>, ctx: ToolCallContext) => Promise<ToolCallResult>
> = {
  create_log_entry: handleCreateLogEntry,
  manage_checklist: handleManageChecklist,
  update_boat_status: handleUpdateBoatStatus,
  update_route_progress: handleUpdateRouteProgress,
  create_reminder: handleCreateReminder,
  get_weather: handleGetWeather,
}

// ── 1. create_log_entry ──────────────────────────────────────────────────────

async function handleCreateLogEntry(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const { supabase, userId, voyageId } = ctx

  const position = input.position as string
  const entryType = (input.entry_type as string) || 'navigation'
  const fuelTank = input.fuel_tank as string | undefined
  const jerricans = input.jerricans as number | undefined
  const water = input.water as string | undefined
  const problems = input.problems as string | undefined
  const notes = input.notes as string | undefined
  const latitude = input.latitude as number | undefined
  const longitude = input.longitude as number | undefined

  // Insérer l'entrée journal
  const { error: logError } = await supabase.from('logs').insert({
    user_id: userId,
    voyage_id: voyageId,
    position,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    entry_type: entryType as 'navigation' | 'arrival' | 'departure' | 'maintenance' | 'incident',
    fuel_tank: (fuelTank as 'full' | '3/4' | 'half' | '1/4' | 'reserve' | 'empty') ?? null,
    jerricans: jerricans ?? 0,
    water: (water as 'full' | '3/4' | 'half' | '1/4' | 'reserve' | 'empty') ?? null,
    problems: problems ?? null,
    notes: notes ?? null,
  })

  if (logError) {
    return { success: false, summary: `Erreur insertion journal: ${logError.message}` }
  }

  // Mettre à jour boat_status si on a des infos pertinentes
  const statusUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (position) statusUpdate.current_position = position
  if (latitude != null) statusUpdate.current_lat = latitude
  if (longitude != null) statusUpdate.current_lon = longitude
  if (fuelTank) statusUpdate.fuel_tank = fuelTank
  if (jerricans != null) statusUpdate.jerricans = jerricans
  if (water) statusUpdate.water = water
  if (problems) {
    statusUpdate.active_problems = [problems]
  }
  if (entryType === 'arrival') statusUpdate.nav_status = 'in_port'
  if (entryType === 'departure') statusUpdate.nav_status = 'sailing'

  await supabase
    .from('boat_status')
    .update(statusUpdate)
    .eq('voyage_id', voyageId)

  const parts = [`Journal: ${entryType} à ${position}`]
  if (fuelTank) parts.push(`carburant ${fuelTank}`)
  if (water) parts.push(`eau ${water}`)
  if (problems) parts.push(`problème: ${problems}`)

  return { success: true, summary: parts.join(', ') }
}

// ── 2. manage_checklist ──────────────────────────────────────────────────────

async function handleManageChecklist(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const { supabase, voyageId } = ctx
  const action = input.action as string

  if (action === 'add') {
    const task = input.task as string
    if (!task) return { success: false, summary: 'Nom de tâche requis pour ajouter un élément' }

    const { error } = await supabase.from('checklist').insert({
      voyage_id: voyageId,
      task,
      category: (input.category as 'Safety' | 'Propulsion' | 'Navigation' | 'Rigging' | 'Comfort' | 'Admin') ?? null,
      priority: (input.priority as 'Critical' | 'High' | 'Normal' | 'Low') ?? 'Normal',
      status: 'to_do',
      notes: (input.notes as string) ?? null,
    })

    if (error) return { success: false, summary: `Erreur ajout checklist: ${error.message}` }
    return { success: true, summary: `Checklist: "${task}" ajouté` }
  }

  if (action === 'check' || action === 'uncheck') {
    const task = input.task as string
    if (!task) return { success: false, summary: 'Nom de tâche requis pour cocher/décocher' }

    // Recherche fuzzy par nom de tâche
    const { data: items, error: fetchError } = await supabase
      .from('checklist')
      .select('*')
      .eq('voyage_id', voyageId)
      .ilike('task', `%${task}%`)
      .returns<ChecklistRow[]>()

    if (fetchError) return { success: false, summary: `Erreur recherche: ${fetchError.message}` }
    if (!items || items.length === 0) {
      return { success: false, summary: `Aucun élément trouvé pour "${task}"` }
    }

    const item = items[0]
    const newStatus = action === 'check' ? 'done' : 'to_do'
    const { error: updateError } = await supabase
      .from('checklist')
      .update({
        status: newStatus,
        completed_at: action === 'check' ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    if (updateError) return { success: false, summary: `Erreur mise à jour: ${updateError.message}` }
    return {
      success: true,
      summary: `Checklist: "${item.task}" → ${newStatus === 'done' ? 'fait ✓' : 'à faire'}`,
    }
  }

  if (action === 'list') {
    const { data: items, error: fetchError } = await supabase
      .from('checklist')
      .select('*')
      .eq('voyage_id', voyageId)
      .in('status', ['to_do', 'in_progress'])
      .order('priority', { ascending: true })
      .returns<ChecklistRow[]>()

    if (fetchError) return { success: false, summary: `Erreur lecture: ${fetchError.message}` }
    if (!items || items.length === 0) {
      return { success: true, summary: 'Checklist: aucun élément en attente', data: { items: [] } }
    }

    const list = items.map((i) => `- [${i.priority}] ${i.task} (${i.status})`).join('\n')
    return {
      success: true,
      summary: `${items.length} élément(s) en attente:\n${list}`,
      data: { items },
    }
  }

  return { success: false, summary: `Action checklist inconnue: ${action}` }
}

// ── 3. update_boat_status ────────────────────────────────────────────────────

async function handleUpdateBoatStatus(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const { supabase, voyageId } = ctx

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  const changes: string[] = []

  if (input.current_position != null) {
    update.current_position = input.current_position
    changes.push(`position: ${input.current_position}`)
  }
  if (input.current_lat != null) update.current_lat = input.current_lat
  if (input.current_lon != null) update.current_lon = input.current_lon
  if (input.fuel_tank != null) {
    update.fuel_tank = input.fuel_tank
    changes.push(`carburant: ${input.fuel_tank}`)
  }
  if (input.jerricans != null) {
    update.jerricans = input.jerricans
    changes.push(`jerricans: ${input.jerricans}`)
  }
  if (input.water != null) {
    update.water = input.water
    changes.push(`eau: ${input.water}`)
  }
  if (input.nav_status != null) {
    update.nav_status = input.nav_status
    changes.push(`statut: ${input.nav_status}`)
  }
  if (input.active_problems != null) {
    update.active_problems = input.active_problems
    const problems = input.active_problems as string[]
    changes.push(`problèmes: ${problems.length === 0 ? 'aucun' : problems.join(', ')}`)
  }

  if (changes.length === 0) {
    return { success: false, summary: 'Aucune mise à jour spécifiée' }
  }

  const { error } = await supabase
    .from('boat_status')
    .update(update)
    .eq('voyage_id', voyageId)

  if (error) return { success: false, summary: `Erreur mise à jour: ${error.message}` }

  return { success: true, summary: `État du bateau mis à jour: ${changes.join(', ')}` }
}

// ── 4. update_route_progress ─────────────────────────────────────────────────

async function handleUpdateRouteProgress(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const { supabase, voyageId } = ctx
  const stepName = input.step_name as string
  const newStatus = input.new_status as 'done' | 'in_progress'

  // Chercher l'étape par nom (fuzzy)
  const { data: steps, error: fetchError } = await supabase
    .from('route_steps')
    .select('*')
    .eq('voyage_id', voyageId)
    .order('order_num', { ascending: true })
    .returns<RouteStepRow[]>()

  if (fetchError) return { success: false, summary: `Erreur lecture route: ${fetchError.message}` }
  if (!steps || steps.length === 0) {
    return { success: false, summary: 'Aucune étape de route définie' }
  }

  // Recherche fuzzy
  const normalizedSearch = stepName.toLowerCase()
  const matchedStep = steps.find(
    (s) =>
      s.name.toLowerCase().includes(normalizedSearch) ||
      s.from_port.toLowerCase().includes(normalizedSearch) ||
      s.to_port.toLowerCase().includes(normalizedSearch)
  )

  if (!matchedStep) {
    const available = steps.map((s) => s.name).join(', ')
    return {
      success: false,
      summary: `Étape "${stepName}" non trouvée. Étapes disponibles: ${available}`,
    }
  }

  // Mettre à jour l'étape
  const { error: updateError } = await supabase
    .from('route_steps')
    .update({ status: newStatus })
    .eq('id', matchedStep.id)

  if (updateError) return { success: false, summary: `Erreur mise à jour: ${updateError.message}` }

  // Si on marque done, passer la suivante en in_progress
  if (newStatus === 'done') {
    const nextStep = steps.find((s) => s.order_num === matchedStep.order_num + 1)
    if (nextStep && nextStep.status === 'to_do') {
      await supabase
        .from('route_steps')
        .update({ status: 'in_progress' })
        .eq('id', nextStep.id)

      // Mettre à jour current_step_id dans boat_status
      await supabase
        .from('boat_status')
        .update({
          current_step_id: nextStep.id,
          current_position: nextStep.from_port,
          updated_at: new Date().toISOString(),
        })
        .eq('voyage_id', voyageId)

      return {
        success: true,
        summary: `Route: "${matchedStep.name}" terminée ✓, "${nextStep.name}" maintenant en cours`,
      }
    }

    return { success: true, summary: `Route: "${matchedStep.name}" terminée ✓` }
  }

  return { success: true, summary: `Route: "${matchedStep.name}" → en cours` }
}

// ── 5. create_reminder ───────────────────────────────────────────────────────

async function handleCreateReminder(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const { supabase, userId, voyageId } = ctx

  const message = input.message as string
  const remindAt = input.remind_at as string
  const category = (input.category as string) ?? 'general'
  const priority = (input.priority as string) ?? 'medium'

  if (!message || !remindAt) {
    return { success: false, summary: 'Message et date/heure requis pour créer un rappel' }
  }

  // Valider la date
  const remindDate = new Date(remindAt)
  if (isNaN(remindDate.getTime())) {
    return { success: false, summary: `Date invalide: ${remindAt}` }
  }

  const { error } = await supabase.from('reminders').insert({
    user_id: userId,
    voyage_id: voyageId,
    message,
    remind_at: remindAt,
    category: category as 'navigation' | 'safety' | 'maintenance' | 'provisions' | 'general',
    priority: priority as 'high' | 'medium' | 'low',
    status: 'pending',
    created_by: 'ai',
  })

  if (error) return { success: false, summary: `Erreur création rappel: ${error.message}` }

  const formattedDate = remindDate.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return {
    success: true,
    summary: `Rappel programmé pour le ${formattedDate}: "${message}"`,
  }
}

// ── 6. get_weather ───────────────────────────────────────────────────────────

async function handleGetWeather(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const latitude = input.latitude as number
  const longitude = input.longitude as number
  const locationName = (input.location_name as string) || `${latitude.toFixed(2)}N, ${longitude.toFixed(2)}E`

  // Ignorer ctx — lecture seule, pas de mutation
  void ctx

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT ?? 3000}`

    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
    })

    const response = await fetch(`${baseUrl}/api/weather?${params}`)

    if (!response.ok) {
      return { success: false, summary: `Météo indisponible pour ${locationName} (erreur ${response.status})` }
    }

    const weatherData = await response.json() as { summary?: string }

    return {
      success: true,
      summary: `Météo ${locationName}:\n${weatherData.summary ?? 'Données brutes disponibles, pas de résumé.'}`,
      data: weatherData as Record<string, unknown>,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return { success: false, summary: `Erreur météo: ${message}` }
  }
}
