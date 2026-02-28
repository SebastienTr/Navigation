// ── Types partagés pour Bosco ──────────────────────────────────

import type { Database } from '@/lib/supabase/types'

// ── Alias pratiques pour les types DB ──────────────────────────────────────

type Tables = Database['public']['Tables']

export type UserRow = Tables['users']['Row']
export type BoatRow = Tables['boats']['Row']
export type NavProfileRow = Tables['nav_profiles']['Row']
export type VoyageRow = Tables['voyages']['Row']
export type BoatStatusRow = Tables['boat_status']['Row']
export type RouteStepRow = Tables['route_steps']['Row']
export type BriefingRow = Tables['briefings']['Row']
export type LogRow = Tables['logs']['Row']
export type ChecklistRow = Tables['checklist']['Row']
export type ChatHistoryRow = Tables['chat_history']['Row']
export type ReminderRow = Tables['reminders']['Row']
export type AiMemoryRow = Tables['ai_memory']['Row']

// ── Verdict ────────────────────────────────────────────────────────────────

export type Verdict = 'GO' | 'STANDBY' | 'NO-GO'
export type Confidence = 'high' | 'medium' | 'low'

// ── Profil navigateur ──────────────────────────────────────────────────────

export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Experienced' | 'Pro'
export type CrewMode = 'Solo' | 'Duo' | 'Family' | 'Full crew'
export type RiskTolerance = 'Cautious' | 'Moderate' | 'Bold'
export type NightSailing = 'No' | 'Yes' | 'Only if necessary'

export interface NavigatorProfile {
  experience: ExperienceLevel | null
  crewMode: CrewMode | null
  riskTolerance: RiskTolerance | null
  nightSailing: NightSailing | null
  maxContinuousHours: number | null
}

// ── Meteo ──────────────────────────────────────────────────────────────────

export interface WeatherHourly {
  time: string
  windSpeed: number       // km/h
  windDirection: number   // degres
  windGusts: number       // km/h
  waveHeight: number      // metres
  wavePeriod: number      // secondes
  visibility: number      // metres
  temperature: number     // celsius
  precipitation: number   // mm
  cloudCover: number      // pourcentage
  weatherCode: number
}

export interface WeatherData {
  latitude: number
  longitude: number
  timezone: string
  hourly: WeatherHourly[]
  /** Resume textuel pour injection dans le prompt */
  summary: string
}

// ── Marees ─────────────────────────────────────────────────────────────────

export interface TideExtreme {
  date: string
  type: 'High' | 'Low'
  height: number // metres
}

export interface TideHeight {
  date: string
  height: number
}

export interface TideData {
  station: string
  latitude: number
  longitude: number
  extremes: TideExtreme[]
  heights: TideHeight[]
  /** Resume textuel pour injection dans le prompt */
  summary: string
}

// ── Route AI ───────────────────────────────────────────────────────────────

export interface RouteStep {
  orderNum: number
  name: string
  fromPort: string
  toPort: string
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
  distanceNm: number | null
  distanceKm: number | null
  phase: string
  notes: string
}

export interface RouteProposal {
  name: string
  summary: string
  totalDistanceNm: number
  totalDistanceKm: number
  estimatedDays: number
  pros: string[]
  cons: string[]
  warnings: string[]
  steps: RouteStep[]
}

// ── Contextes AI ───────────────────────────────────────────────────────────

export interface MemoryDocs {
  situation: string
  boat: string
  crew: string
  preferences: string
}

export interface BriefingContext {
  boat: BoatRow
  profile: NavProfileRow | null
  boatStatus: BoatStatusRow | null
  latestLogs: LogRow[]
  routeSteps: RouteStepRow[]
  currentStep: RouteStepRow | null
  weather: WeatherData | null
  tides: TideData | null
  checklist: ChecklistRow[]
  memory: MemoryDocs | null
  date: string
}

export interface ChatContext {
  boat: BoatRow
  profile: NavProfileRow | null
  boatStatus: BoatStatusRow | null
  latestLogs: LogRow[]
  routeSteps: RouteStepRow[]
  currentStep: RouteStepRow | null
  weather: WeatherData | null
  tides: TideData | null
  checklist: ChecklistRow[]
  latestBriefing: BriefingRow | null
  recentChat: ChatHistoryRow[]
  reminders: ReminderRow[]
  memory: MemoryDocs | null
  date: string
}

export interface TriggerContext {
  boat: BoatRow
  boatStatus: BoatStatusRow | null
  latestLogs: LogRow[]
  latestBriefing: BriefingRow | null
  checklist: ChecklistRow[]
  routeSteps: RouteStepRow[]
  memory: MemoryDocs | null
  date: string
}

// ── Trigger types ──────────────────────────────────────────────────────────

export type TriggerType =
  | 'weather_change'
  | 'log_reminder'
  | 'departure_watch'
  | 'critical_checklist'
  | 'low_fuel'

// ── Messages AI ────────────────────────────────────────────────────────────

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CallClaudeOptions {
  systemPrompt: string
  messages: AIMessage[]
  model?: string
  stream?: boolean
  maxTokens?: number
}
