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
  manage_route: handleManageRoute,
  create_reminder: handleCreateReminder,
  get_weather: handleGetWeather,
  get_tides: handleGetTides,
  update_memory: handleUpdateMemory,
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

  if (action === 'add_batch') {
    const items = input.items as Array<{ task: string; category?: string; priority?: string; notes?: string }> | undefined
    if (!items || items.length === 0) return { success: false, summary: 'Liste d\'items requise pour add_batch' }

    const rows = items.map((item) => ({
      voyage_id: voyageId,
      task: item.task,
      category: (item.category as 'Safety' | 'Propulsion' | 'Navigation' | 'Rigging' | 'Comfort' | 'Admin') ?? null,
      priority: (item.priority as 'Critical' | 'High' | 'Normal' | 'Low') ?? 'Normal',
      status: 'to_do' as const,
      notes: item.notes ?? null,
    }))

    const { error } = await supabase.from('checklist').insert(rows)

    if (error) return { success: false, summary: `Erreur ajout batch checklist: ${error.message}` }
    const names = items.map((i) => i.task).join(', ')
    return { success: true, summary: `Checklist: ${items.length} items ajoutés (${names})` }
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

  if (action === 'delete') {
    const task = input.task as string
    if (!task) return { success: false, summary: 'Nom de tâche requis pour supprimer' }

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
    const { error: deleteError } = await supabase
      .from('checklist')
      .delete()
      .eq('id', item.id)

    if (deleteError) return { success: false, summary: `Erreur suppression: ${deleteError.message}` }
    return { success: true, summary: `Checklist: "${item.task}" supprimé` }
  }

  if (action === 'edit') {
    const task = input.task as string
    if (!task) return { success: false, summary: 'Nom de tâche requis pour modifier' }

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
    const update: Record<string, unknown> = {}
    const changes: string[] = []

    if (input.new_task) {
      update.task = input.new_task
      changes.push(`nom: "${input.new_task}"`)
    }
    if (input.category) {
      update.category = input.category
      changes.push(`catégorie: ${input.category}`)
    }
    if (input.priority) {
      update.priority = input.priority
      changes.push(`priorité: ${input.priority}`)
    }
    if (input.notes != null) {
      update.notes = input.notes || null
      changes.push(`notes mises à jour`)
    }

    if (changes.length === 0) {
      return { success: false, summary: 'Aucune modification spécifiée' }
    }

    const { error: updateError } = await supabase
      .from('checklist')
      .update(update)
      .eq('id', item.id)

    if (updateError) return { success: false, summary: `Erreur modification: ${updateError.message}` }
    return { success: true, summary: `Checklist: "${item.task}" modifié (${changes.join(', ')})` }
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

// ── 4. manage_route ──────────────────────────────────────────────────────────

async function handleManageRoute(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const { supabase, voyageId } = ctx
  const action = input.action as string

  // Helper: fetch all steps ordered
  async function fetchSteps() {
    const { data, error } = await supabase
      .from('route_steps')
      .select('*')
      .eq('voyage_id', voyageId)
      .order('order_num', { ascending: true })
      .returns<RouteStepRow[]>()
    return { steps: data ?? [], error }
  }

  // Helper: fuzzy match a step by name
  function findStep(steps: RouteStepRow[], name: string): RouteStepRow | undefined {
    const normalized = name.toLowerCase()
    return steps.find(
      (s) =>
        s.name.toLowerCase().includes(normalized) ||
        s.from_port.toLowerCase().includes(normalized) ||
        s.to_port.toLowerCase().includes(normalized)
    )
  }

  // ── update_status ──
  if (action === 'update_status') {
    const stepName = input.step_name as string
    const newStatus = input.new_status as 'done' | 'in_progress'
    if (!stepName || !newStatus) {
      return { success: false, summary: 'step_name et new_status requis pour update_status' }
    }

    const { steps, error: fetchError } = await fetchSteps()
    if (fetchError) return { success: false, summary: `Erreur lecture route: ${fetchError.message}` }
    if (steps.length === 0) return { success: false, summary: 'Aucune étape de route définie' }

    const matchedStep = findStep(steps, stepName)
    if (!matchedStep) {
      const available = steps.map((s) => s.name).join(', ')
      return { success: false, summary: `Étape "${stepName}" non trouvée. Étapes disponibles: ${available}` }
    }

    const { error: updateError } = await supabase
      .from('route_steps')
      .update({ status: newStatus })
      .eq('id', matchedStep.id)

    if (updateError) return { success: false, summary: `Erreur mise à jour: ${updateError.message}` }

    if (newStatus === 'done') {
      const nextStep = steps.find((s) => s.order_num === matchedStep.order_num + 1)
      if (nextStep && nextStep.status === 'to_do') {
        await supabase.from('route_steps').update({ status: 'in_progress' }).eq('id', nextStep.id)
        await supabase
          .from('boat_status')
          .update({ current_step_id: nextStep.id, current_position: nextStep.from_port, updated_at: new Date().toISOString() })
          .eq('voyage_id', voyageId)
        return { success: true, summary: `Route: "${matchedStep.name}" terminée ✓, "${nextStep.name}" maintenant en cours` }
      }
      return { success: true, summary: `Route: "${matchedStep.name}" terminée ✓` }
    }

    return { success: true, summary: `Route: "${matchedStep.name}" → en cours` }
  }

  // ── add_step ──
  if (action === 'add_step') {
    const stepName = input.step_name as string
    const fromPort = input.from_port as string
    const toPort = input.to_port as string
    if (!fromPort || !toPort) {
      return { success: false, summary: 'from_port et to_port requis pour add_step' }
    }

    const { steps, error: fetchError } = await fetchSteps()
    if (fetchError) return { success: false, summary: `Erreur lecture route: ${fetchError.message}` }

    let insertAfterOrder = steps.length // default: append at end
    const afterStepName = input.after_step_name as string | undefined
    if (afterStepName) {
      const afterStep = findStep(steps, afterStepName)
      if (!afterStep) {
        return { success: false, summary: `Étape de référence "${afterStepName}" non trouvée` }
      }
      insertAfterOrder = afterStep.order_num
    }

    // Shift order_num for all steps after insertion point
    const stepsToShift = steps.filter((s) => s.order_num > insertAfterOrder)
    for (const s of stepsToShift) {
      await supabase.from('route_steps').update({ order_num: s.order_num + 1 }).eq('id', s.id)
    }

    const newOrderNum = insertAfterOrder + 1
    const name = stepName || `${fromPort} → ${toPort}`

    const { error: insertError } = await supabase.from('route_steps').insert({
      voyage_id: voyageId,
      order_num: newOrderNum,
      name,
      from_port: fromPort,
      to_port: toPort,
      phase: (input.phase as string) ?? null,
      distance_nm: (input.distance_nm as number) ?? null,
      distance_km: (input.distance_km as number) ?? null,
      notes: (input.notes as string) ?? null,
      status: 'to_do' as const,
    })

    if (insertError) return { success: false, summary: `Erreur insertion: ${insertError.message}` }

    const afterLabel = afterStepName ? ` après "${afterStepName}"` : ' en fin de route'
    return { success: true, summary: `Route: étape "${name}" ajoutée${afterLabel}` }
  }

  // ── edit_step ──
  if (action === 'edit_step') {
    const stepName = input.step_name as string
    if (!stepName) return { success: false, summary: 'step_name requis pour edit_step' }

    const { steps, error: fetchError } = await fetchSteps()
    if (fetchError) return { success: false, summary: `Erreur lecture route: ${fetchError.message}` }

    const matchedStep = findStep(steps, stepName)
    if (!matchedStep) {
      const available = steps.map((s) => s.name).join(', ')
      return { success: false, summary: `Étape "${stepName}" non trouvée. Étapes: ${available}` }
    }

    const update: Record<string, unknown> = {}
    const changes: string[] = []

    if (input.from_port) { update.from_port = input.from_port; changes.push(`départ: ${input.from_port}`) }
    if (input.to_port) { update.to_port = input.to_port; changes.push(`arrivée: ${input.to_port}`) }
    if (input.phase) { update.phase = input.phase; changes.push(`phase: ${input.phase}`) }
    if (input.distance_nm != null) { update.distance_nm = input.distance_nm; changes.push(`${input.distance_nm} NM`) }
    if (input.distance_km != null) { update.distance_km = input.distance_km; changes.push(`${input.distance_km} km`) }
    if (input.notes != null) { update.notes = input.notes || null; changes.push('notes mises à jour') }

    // Update name if from_port or to_port changed
    if (input.from_port || input.to_port) {
      const newFrom = (input.from_port as string) || matchedStep.from_port
      const newTo = (input.to_port as string) || matchedStep.to_port
      update.name = `${newFrom} → ${newTo}`
    }

    if (changes.length === 0) return { success: false, summary: 'Aucune modification spécifiée' }

    const { error: updateError } = await supabase
      .from('route_steps')
      .update(update)
      .eq('id', matchedStep.id)

    if (updateError) return { success: false, summary: `Erreur modification: ${updateError.message}` }
    return { success: true, summary: `Route: "${matchedStep.name}" modifiée (${changes.join(', ')})` }
  }

  // ── delete_step ──
  if (action === 'delete_step') {
    const stepName = input.step_name as string
    if (!stepName) return { success: false, summary: 'step_name requis pour delete_step' }

    const { steps, error: fetchError } = await fetchSteps()
    if (fetchError) return { success: false, summary: `Erreur lecture route: ${fetchError.message}` }

    const matchedStep = findStep(steps, stepName)
    if (!matchedStep) {
      const available = steps.map((s) => s.name).join(', ')
      return { success: false, summary: `Étape "${stepName}" non trouvée. Étapes: ${available}` }
    }

    const { error: deleteError } = await supabase
      .from('route_steps')
      .delete()
      .eq('id', matchedStep.id)

    if (deleteError) return { success: false, summary: `Erreur suppression: ${deleteError.message}` }

    // Re-number remaining steps
    const remaining = steps.filter((s) => s.id !== matchedStep.id)
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order_num !== i + 1) {
        await supabase.from('route_steps').update({ order_num: i + 1 }).eq('id', remaining[i].id)
      }
    }

    return { success: true, summary: `Route: étape "${matchedStep.name}" supprimée` }
  }

  // ── list ──
  if (action === 'list') {
    const { steps, error: fetchError } = await fetchSteps()
    if (fetchError) return { success: false, summary: `Erreur lecture route: ${fetchError.message}` }
    if (steps.length === 0) return { success: true, summary: 'Aucune étape de route définie', data: { steps: [] } }

    const list = steps.map((s) => {
      const dist = s.distance_nm ? `${s.distance_nm} NM` : s.distance_km ? `${s.distance_km} km` : ''
      const status = s.status === 'done' ? '✓' : s.status === 'in_progress' ? '►' : '○'
      return `${status} ${s.order_num}. ${s.name} (${s.from_port} → ${s.to_port})${dist ? ` — ${dist}` : ''}${s.phase ? ` [${s.phase}]` : ''}`
    }).join('\n')

    return { success: true, summary: `Route (${steps.length} étapes):\n${list}`, data: { steps } }
  }

  return { success: false, summary: `Action route inconnue: ${action}` }
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

// ── 7. get_tides ──────────────────────────────────────────────────────────

async function handleGetTides(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const latitude = input.latitude as number
  const longitude = input.longitude as number
  const locationName = (input.location_name as string) || `${latitude.toFixed(2)}N, ${longitude.toFixed(2)}E`
  const days = (input.days as number) || 3

  void ctx

  try {
    const { getTides } = await import('@/lib/weather/worldtides')
    const tideData = await getTides(latitude, longitude, days)

    if (!tideData) {
      return { success: false, summary: 'Données de marées indisponibles (clé API WorldTides non configurée).' }
    }

    // Formater les extrêmes pour que Claude puisse les interpréter
    const extremesSummary = tideData.extremes.map((e) => {
      const date = new Date(e.dt * 1000)
      const timeStr = date.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
      return `${e.type === 'High' ? 'PM' : 'BM'} ${timeStr} — ${e.height.toFixed(2)}m`
    }).join('\n')

    const station = tideData.station ? ` (station: ${tideData.station})` : ''

    return {
      success: true,
      summary: `Marées ${locationName}${station} (${days}j):\n${extremesSummary}`,
      data: tideData as unknown as Record<string, unknown>,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return { success: false, summary: `Erreur marées: ${message}` }
  }
}

// ── 8. update_memory ──────────────────────────────────────────────────────

async function handleUpdateMemory(
  input: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<ToolCallResult> {
  const { supabase, userId, voyageId } = ctx
  const slug = input.slug as 'situation' | 'boat' | 'crew' | 'preferences'
  const content = input.content as string

  if (!slug || !content) {
    return { success: false, summary: 'slug et content requis' }
  }

  // Check if doc already exists
  const { data: existing } = await supabase
    .from('ai_memory')
    .select('id, version')
    .eq('voyage_id', voyageId)
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    const newVersion = existing.version + 1

    // Save current version to history
    await supabase.from('ai_memory_versions').insert({
      memory_id: existing.id,
      content,
      version: newVersion,
      updated_by: 'chat',
    })

    // Prune old versions (keep last 5)
    const { data: versions } = await supabase
      .from('ai_memory_versions')
      .select('id')
      .eq('memory_id', existing.id)
      .order('version', { ascending: false })
      .range(5, 100)

    if (versions && versions.length > 0) {
      await supabase
        .from('ai_memory_versions')
        .delete()
        .in('id', versions.map((v) => v.id))
    }

    // Update main doc
    const { error } = await supabase
      .from('ai_memory')
      .update({
        content,
        version: newVersion,
        updated_at: new Date().toISOString(),
        updated_by: 'chat' as const,
      })
      .eq('id', existing.id)

    if (error) return { success: false, summary: `Erreur mise à jour mémoire: ${error.message}` }
    return { success: true, summary: `Mémoire "${slug}" mise à jour (v${newVersion})` }
  } else {
    // Create new doc
    const { data: inserted, error } = await supabase
      .from('ai_memory')
      .insert({
        user_id: userId,
        voyage_id: voyageId,
        slug,
        content,
        version: 1,
        updated_by: 'chat' as const,
      })
      .select('id')
      .single()

    if (error) return { success: false, summary: `Erreur création mémoire: ${error.message}` }

    // Save first version
    if (inserted) {
      await supabase.from('ai_memory_versions').insert({
        memory_id: inserted.id,
        content,
        version: 1,
        updated_by: 'chat',
      })
    }

    return { success: true, summary: `Mémoire "${slug}" créée` }
  }
}
