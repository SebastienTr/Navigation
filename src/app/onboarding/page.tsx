'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ship,
  User,
  Map,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  AlertTriangle,
  SkipForward,
  Anchor,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth/context'
import type { Database } from '@/lib/supabase/types'

type BoatRow = Database['public']['Tables']['boats']['Row']
type NavProfileRow = Database['public']['Tables']['nav_profiles']['Row']
type VoyageRow = Database['public']['Tables']['voyages']['Row']

// ── Types ──────────────────────────────────────────────────────────────

interface BoatData {
  name: string
  type: string
  length_m: string
  draft_m: string
  air_draft_m: string
  engine_type: string
  fuel_capacity_hours: string
  avg_speed_kn: string
  has_ais_tx: boolean
  has_autopilot: boolean
  has_radar: boolean
  has_watermaker: boolean
}

interface ProfileData {
  experience: string
  crew_mode: string
  risk_tolerance: string
  night_sailing: string
  max_continuous_hours: string
}

interface VoyageData {
  name: string
  departure_port: string
  arrival_port: string
}

interface RouteStep {
  order_num: number
  name: string
  from_port: string
  to_port: string
  distance_nm: number | null
  distance_km: number | null
  phase: string | null
  notes: string | null
  from_lat: number | null
  from_lon: number | null
  to_lat: number | null
  to_lon: number | null
}

interface RouteOption {
  id: string
  name: string
  summary: string
  distance: string
  estimated_days: string
  pros: string[]
  cons: string[]
  warnings: string[]
  steps: RouteStep[]
}

// ── Step components ────────────────────────────────────────────────────

function StepBoat({
  data,
  onChange,
}: {
  data: BoatData
  onChange: (data: BoatData) => void
}) {
  const update = (field: keyof BoatData, value: string | boolean) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Ship className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Mon Bateau
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Caractéristiques de votre navire
          </p>
        </div>
      </div>

      <FieldText
        label="Nom du bateau"
        placeholder="ex: Laurine"
        value={data.name}
        onChange={(v) => update('name', v)}
        required
      />

      <FieldText
        label="Type"
        placeholder="ex: Laurin Koster 28"
        value={data.type}
        onChange={(v) => update('type', v)}
      />

      <div className="grid grid-cols-2 gap-4">
        <FieldNumber
          label="Longueur (m)"
          placeholder="8.5"
          value={data.length_m}
          onChange={(v) => update('length_m', v)}
          step="0.1"
        />
        <FieldNumber
          label="Tirant d'eau (m)"
          placeholder="1.45"
          value={data.draft_m}
          onChange={(v) => update('draft_m', v)}
          step="0.01"
        />
      </div>

      <FieldNumber
        label="Tirant d'air (m)"
        placeholder="12"
        value={data.air_draft_m}
        onChange={(v) => update('air_draft_m', v)}
        step="0.1"
      />

      <FieldSelect
        label="Type moteur"
        value={data.engine_type}
        onChange={(v) => update('engine_type', v)}
        options={[
          { value: '', label: 'Sélectionner...' },
          { value: 'Diesel', label: 'Diesel' },
          { value: 'Essence', label: 'Essence' },
          { value: 'Électrique', label: 'Électrique' },
          { value: 'Voilier pur', label: 'Voilier pur' },
        ]}
      />

      <div className="grid grid-cols-2 gap-4">
        <FieldNumber
          label="Autonomie carburant (h)"
          placeholder="40"
          value={data.fuel_capacity_hours}
          onChange={(v) => update('fuel_capacity_hours', v)}
        />
        <FieldNumber
          label="Vitesse moyenne (kn)"
          placeholder="4.5"
          value={data.avg_speed_kn}
          onChange={(v) => update('avg_speed_kn', v)}
          step="0.1"
        />
      </div>

      {/* Equipment checkboxes */}
      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          Équipements
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <FieldCheckbox
            label="AIS émetteur"
            checked={data.has_ais_tx}
            onChange={(v) => update('has_ais_tx', v)}
          />
          <FieldCheckbox
            label="Pilote auto"
            checked={data.has_autopilot}
            onChange={(v) => update('has_autopilot', v)}
          />
          <FieldCheckbox
            label="Radar"
            checked={data.has_radar}
            onChange={(v) => update('has_radar', v)}
          />
          <FieldCheckbox
            label="Dessalinisateur"
            checked={data.has_watermaker}
            onChange={(v) => update('has_watermaker', v)}
          />
        </div>
      </fieldset>
    </div>
  )
}

function StepProfile({
  data,
  onChange,
}: {
  data: ProfileData
  onChange: (data: ProfileData) => void
}) {
  const update = (field: keyof ProfileData, value: string) => {
    onChange({ ...data, [field]: value })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Mon Profil
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pour adapter l&apos;IA à votre style de navigation
          </p>
        </div>
      </div>

      <FieldSelect
        label="Expérience"
        value={data.experience}
        onChange={(v) => update('experience', v)}
        options={[
          { value: '', label: 'Sélectionner...' },
          { value: 'Beginner', label: 'Débutant' },
          { value: 'Intermediate', label: 'Intermédiaire' },
          { value: 'Experienced', label: 'Expérimenté' },
          { value: 'Pro', label: 'Pro' },
        ]}
      />

      <FieldSelect
        label="Mode équipage"
        value={data.crew_mode}
        onChange={(v) => update('crew_mode', v)}
        options={[
          { value: '', label: 'Sélectionner...' },
          { value: 'Solo', label: 'Solo' },
          { value: 'Duo', label: 'Duo' },
          { value: 'Family', label: 'Famille' },
          { value: 'Full crew', label: 'Équipage complet' },
        ]}
      />

      <FieldSelect
        label="Tolérance au risque"
        value={data.risk_tolerance}
        onChange={(v) => update('risk_tolerance', v)}
        options={[
          { value: '', label: 'Sélectionner...' },
          { value: 'Cautious', label: 'Prudent' },
          { value: 'Moderate', label: 'Modéré' },
          { value: 'Bold', label: 'Audacieux' },
        ]}
      />

      <FieldSelect
        label="Navigation de nuit"
        value={data.night_sailing}
        onChange={(v) => update('night_sailing', v)}
        options={[
          { value: '', label: 'Sélectionner...' },
          { value: 'No', label: 'Non' },
          { value: 'Yes', label: 'Oui' },
          { value: 'Only if necessary', label: 'Seulement si nécessaire' },
        ]}
      />

      <FieldNumber
        label="Heures max continues de navigation"
        placeholder="12"
        value={data.max_continuous_hours}
        onChange={(v) => update('max_continuous_hours', v)}
      />
    </div>
  )
}

function StepVoyage({
  data,
  onChange,
  boatData,
  profileData,
  onRouteConfirmed,
}: {
  data: VoyageData
  onChange: (data: VoyageData) => void
  boatData: BoatData
  profileData: ProfileData
  onRouteConfirmed: (route: RouteOption | null) => void
}) {
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customDescription, setCustomDescription] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const update = (field: keyof VoyageData, value: string) => {
    onChange({ ...data, [field]: value })
    // Reset route selection when ports change
    setRouteOptions([])
    setSelectedRoute(null)
    setConfirmed(false)
    onRouteConfirmed(null)
  }

  const generateRoutes = async (customText?: string) => {
    setLoadingRoutes(true)
    setRouteError(null)
    setRouteOptions([])
    setSelectedRoute(null)
    setConfirmed(false)

    try {
      const res = await fetch('/api/ai/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure_port: data.departure_port,
          arrival_port: data.arrival_port,
          custom_description: customText || undefined,
          boat: {
            name: boatData.name,
            type: boatData.type,
            length_m: boatData.length_m ? parseFloat(boatData.length_m) : null,
            draft_m: boatData.draft_m ? parseFloat(boatData.draft_m) : null,
            air_draft_m: boatData.air_draft_m
              ? parseFloat(boatData.air_draft_m)
              : null,
            engine_type: boatData.engine_type,
            fuel_capacity_hours: boatData.fuel_capacity_hours
              ? parseFloat(boatData.fuel_capacity_hours)
              : null,
            avg_speed_kn: boatData.avg_speed_kn
              ? parseFloat(boatData.avg_speed_kn)
              : null,
          },
          profile: {
            experience: profileData.experience,
            crew_mode: profileData.crew_mode,
            risk_tolerance: profileData.risk_tolerance,
            night_sailing: profileData.night_sailing,
            max_continuous_hours: profileData.max_continuous_hours
              ? parseFloat(profileData.max_continuous_hours)
              : null,
          },
        }),
      })

      if (!res.ok) {
        throw new Error('Erreur lors de la génération des routes')
      }

      const result = await res.json()
      setRouteOptions(result.options || [])
    } catch {
      setRouteError(
        'Impossible de générer les itinéraires. Vérifiez votre connexion et réessayez.'
      )
    } finally {
      setLoadingRoutes(false)
    }
  }

  const canGenerate = data.departure_port.trim() && data.arrival_port.trim()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <Map className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Mon Voyage
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Définissez votre itinéraire avec l&apos;aide de l&apos;IA
          </p>
        </div>
      </div>

      <FieldText
        label="Nom du voyage"
        placeholder="ex: Audierne → Nice"
        value={data.name}
        onChange={(v) => update('name', v)}
        required
      />

      <FieldText
        label="Port de départ"
        placeholder="ex: Audierne"
        value={data.departure_port}
        onChange={(v) => update('departure_port', v)}
        required
      />

      <FieldText
        label="Port d'arrivée"
        placeholder="ex: Nice"
        value={data.arrival_port}
        onChange={(v) => update('arrival_port', v)}
        required
      />

      {/* Generate button */}
      {!loadingRoutes && routeOptions.length === 0 && !confirmed && (
        <button
          type="button"
          disabled={!canGenerate || loadingRoutes}
          onClick={() => generateRoutes()}
          className="w-full h-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          Générer les itinéraires
        </button>
      )}

      {/* Loading state */}
      {loadingRoutes && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            L&apos;IA analyse les routes possibles...
          </p>
        </div>
      )}

      {/* Error */}
      {routeError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">
            {routeError}
          </p>
          <button
            type="button"
            onClick={() => generateRoutes()}
            className="mt-2 text-sm font-medium text-red-700 dark:text-red-400 underline min-h-[44px]"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Route options */}
      {routeOptions.length > 0 && !confirmed && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Choisissez un itinéraire :
          </p>

          {routeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setSelectedRoute(option.id)
                setShowCustom(false)
              }}
              className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                selectedRoute === option.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                  {option.name}
                </h3>
                <div
                  className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                    selectedRoute === option.id
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {selectedRoute === option.id && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                {option.summary}
              </p>
              <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
                <span>{option.distance}</span>
                <span>{option.estimated_days}</span>
              </div>

              {/* Pros */}
              {option.pros.length > 0 && (
                <div className="space-y-1 mb-2">
                  {option.pros.map((pro, i) => (
                    <p
                      key={i}
                      className="text-xs text-green-700 dark:text-green-400"
                    >
                      + {pro}
                    </p>
                  ))}
                </div>
              )}

              {/* Cons */}
              {option.cons.length > 0 && (
                <div className="space-y-1 mb-2">
                  {option.cons.map((con, i) => (
                    <p
                      key={i}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      - {con}
                    </p>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {option.warnings.length > 0 && (
                <div className="space-y-1">
                  {option.warnings.map((warning, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {warning}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </button>
          ))}

          {/* Custom "Autre" option */}
          <button
            type="button"
            onClick={() => {
              setSelectedRoute(null)
              setShowCustom(true)
            }}
            className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
              showCustom
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                Autre
              </span>
              <div
                className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  showCustom
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {showCustom && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Décrivez votre itinéraire préféré
            </p>
          </button>

          {/* Custom text area */}
          {showCustom && (
            <div className="space-y-3">
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="ex: Je veux passer par le canal du Midi mais m'arrêter à Bordeaux 3 jours..."
                rows={4}
                className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              />
              <button
                type="button"
                disabled={!customDescription.trim() || loadingRoutes}
                onClick={() => generateRoutes(customDescription)}
                className="w-full h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Générer un itinéraire personnalisé
              </button>
            </div>
          )}

          {/* Map preview placeholder */}
          {selectedRoute && (
            <div className="h-48 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
              <div className="text-center">
                <Map className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  Aperçu de la carte
                </p>
              </div>
            </div>
          )}

          {/* Confirm button */}
          {selectedRoute && (
            <button
              type="button"
              onClick={() => {
                setConfirmed(true)
                const route = routeOptions.find((o) => o.id === selectedRoute) ?? null
                onRouteConfirmed(route)
              }}
              className="w-full h-[52px] rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Valider l&apos;itinéraire
            </button>
          )}
        </div>
      )}

      {/* Confirmed state */}
      {confirmed && selectedRoute && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">
            Itinéraire validé :{' '}
            <span className="font-semibold">
              {routeOptions.find((o) => o.id === selectedRoute)?.name}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function StepDone({
  boatData,
  profileData,
  voyageData,
}: {
  boatData: BoatData
  profileData: ProfileData
  voyageData: VoyageData
}) {
  const experienceLabels: Record<string, string> = {
    Beginner: 'Débutant',
    Intermediate: 'Intermédiaire',
    Experienced: 'Expérimenté',
    Pro: 'Pro',
  }
  const crewLabels: Record<string, string> = {
    Solo: 'Solo',
    Duo: 'Duo',
    Family: 'Famille',
    'Full crew': 'Équipage complet',
  }
  const riskLabels: Record<string, string> = {
    Cautious: 'Prudent',
    Moderate: 'Modéré',
    Bold: 'Audacieux',
  }
  const nightLabels: Record<string, string> = {
    No: 'Non',
    Yes: 'Oui',
    'Only if necessary': 'Si nécessaire',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Terminé !
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vérifiez vos informations
          </p>
        </div>
      </div>

      {/* Boat summary */}
      <SummaryCard title="Bateau" icon={<Ship className="w-4 h-4" />}>
        <SummaryRow label="Nom" value={boatData.name} />
        {boatData.type && <SummaryRow label="Type" value={boatData.type} />}
        {boatData.length_m && (
          <SummaryRow label="Longueur" value={`${boatData.length_m} m`} />
        )}
        {boatData.draft_m && (
          <SummaryRow label="Tirant d'eau" value={`${boatData.draft_m} m`} />
        )}
        {boatData.engine_type && (
          <SummaryRow label="Moteur" value={boatData.engine_type} />
        )}
        {boatData.avg_speed_kn && (
          <SummaryRow
            label="Vitesse moy."
            value={`${boatData.avg_speed_kn} kn`}
          />
        )}
      </SummaryCard>

      {/* Profile summary */}
      <SummaryCard title="Profil" icon={<User className="w-4 h-4" />}>
        {profileData.experience && (
          <SummaryRow
            label="Expérience"
            value={experienceLabels[profileData.experience] || profileData.experience}
          />
        )}
        {profileData.crew_mode && (
          <SummaryRow
            label="Équipage"
            value={crewLabels[profileData.crew_mode] || profileData.crew_mode}
          />
        )}
        {profileData.risk_tolerance && (
          <SummaryRow
            label="Risque"
            value={riskLabels[profileData.risk_tolerance] || profileData.risk_tolerance}
          />
        )}
        {profileData.night_sailing && (
          <SummaryRow
            label="Nuit"
            value={nightLabels[profileData.night_sailing] || profileData.night_sailing}
          />
        )}
        {profileData.max_continuous_hours && (
          <SummaryRow
            label="Heures max"
            value={`${profileData.max_continuous_hours} h`}
          />
        )}
      </SummaryCard>

      {/* Voyage summary */}
      {voyageData.name && (
        <SummaryCard title="Voyage" icon={<Map className="w-4 h-4" />}>
          <SummaryRow label="Nom" value={voyageData.name} />
          {voyageData.departure_port && (
            <SummaryRow label="Départ" value={voyageData.departure_port} />
          )}
          {voyageData.arrival_port && (
            <SummaryRow label="Arrivée" value={voyageData.arrival_port} />
          )}
        </SummaryCard>
      )}
    </div>
  )
}

// ── Reusable form fields ───────────────────────────────────────────────

function FieldText({
  label,
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
      />
    </div>
  )
}

function FieldNumber({
  label,
  placeholder,
  value,
  onChange,
  step,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  step?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step || '1'}
        min="0"
        inputMode="decimal"
        className="w-full h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
      />
    </div>
  )
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base appearance-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function FieldCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 min-h-[44px] cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-2 shrink-0"
      />
      <span className="text-sm text-slate-700 dark:text-slate-300">
        {label}
      </span>
    </label>
  )
}

function SummaryCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-900 dark:text-white">
        {value}
      </span>
    </div>
  )
}

// ── Step configuration ─────────────────────────────────────────────────

const STEPS = [
  { id: 'boat', label: 'Bateau', icon: Ship },
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'voyage', label: 'Voyage', icon: Map },
  { id: 'done', label: 'Terminé', icon: CheckCircle },
] as const

// ── Main onboarding page ───────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [skippedVoyage, setSkippedVoyage] = useState(false)

  const [boatData, setBoatData] = useState<BoatData>({
    name: '',
    type: '',
    length_m: '',
    draft_m: '',
    air_draft_m: '',
    engine_type: '',
    fuel_capacity_hours: '',
    avg_speed_kn: '',
    has_ais_tx: false,
    has_autopilot: false,
    has_radar: false,
    has_watermaker: false,
  })

  const [profileData, setProfileData] = useState<ProfileData>({
    experience: '',
    crew_mode: '',
    risk_tolerance: '',
    night_sailing: '',
    max_continuous_hours: '',
  })

  const [voyageData, setVoyageData] = useState<VoyageData>({
    name: '',
    departure_port: '',
    arrival_port: '',
  })

  const [confirmedRoute, setConfirmedRoute] = useState<RouteOption | null>(null)

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0:
        return boatData.name.trim().length > 0
      case 1:
        return true // Profile fields are optional
      case 2:
        return true // Can skip voyage
      case 3:
        return true
      default:
        return false
    }
  }, [currentStep, boatData.name])

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSkipVoyage = () => {
    setSkippedVoyage(true)
    setCurrentStep(3)
  }

  const handleFinish = async () => {
    if (!user) return
    setSaving(true)
    setSaveError(null)

    try {
      const supabase = createClient()

      // 1. Insert boat
      const { data: boat, error: boatError } = await supabase
        .from('boats')
        .insert({
          user_id: user.id,
          name: boatData.name,
          type: boatData.type || null,
          length_m: boatData.length_m ? parseFloat(boatData.length_m) : null,
          draft_m: boatData.draft_m ? parseFloat(boatData.draft_m) : null,
          air_draft_m: boatData.air_draft_m
            ? parseFloat(boatData.air_draft_m)
            : null,
          engine_type: boatData.engine_type || null,
          fuel_capacity_hours: boatData.fuel_capacity_hours
            ? parseFloat(boatData.fuel_capacity_hours)
            : null,
          avg_speed_kn: boatData.avg_speed_kn
            ? parseFloat(boatData.avg_speed_kn)
            : null,
          has_ais_tx: boatData.has_ais_tx,
          has_autopilot: boatData.has_autopilot,
          has_radar: boatData.has_radar,
          has_watermaker: boatData.has_watermaker,
        })
        .select()
        .returns<BoatRow[]>()
        .single()

      if (boatError) throw new Error(`Bateau : ${boatError.message}`)

      // 2. Insert nav_profile
      const { data: navProfile, error: profileError } = await supabase
        .from('nav_profiles')
        .insert({
          user_id: user.id,
          boat_id: boat.id,
          experience:
            (profileData.experience as
              | 'Beginner'
              | 'Intermediate'
              | 'Experienced'
              | 'Pro') || null,
          crew_mode:
            (profileData.crew_mode as
              | 'Solo'
              | 'Duo'
              | 'Family'
              | 'Full crew') || null,
          risk_tolerance:
            (profileData.risk_tolerance as
              | 'Cautious'
              | 'Moderate'
              | 'Bold') || null,
          night_sailing:
            (profileData.night_sailing as
              | 'No'
              | 'Yes'
              | 'Only if necessary') || null,
          max_continuous_hours: profileData.max_continuous_hours
            ? parseFloat(profileData.max_continuous_hours)
            : null,
        })
        .select()
        .returns<NavProfileRow[]>()
        .single()

      if (profileError) throw new Error(`Profil : ${profileError.message}`)

      // 3. Create voyage (if not skipped)
      if (!skippedVoyage && voyageData.name.trim()) {
        const { data: voyage, error: voyageError } = await supabase
          .from('voyages')
          .insert({
            user_id: user.id,
            boat_id: boat.id,
            nav_profile_id: navProfile.id,
            name: voyageData.name,
            status: 'active' as const,
          })
          .select()
          .returns<VoyageRow[]>()
          .single()

        if (voyageError) throw new Error(`Voyage : ${voyageError.message}`)

        // 4. Initialize boat_status
        const { error: statusError } = await supabase
          .from('boat_status')
          .insert({
            voyage_id: voyage.id,
            current_position: voyageData.departure_port || null,
            fuel_tank: 'full',
            water: 'full',
            jerricans: 0,
            nav_status: 'in_port',
          })

        if (statusError)
          throw new Error(`Statut bateau : ${statusError.message}`)

        // 4b. Insert route_steps if a route was confirmed
        if (confirmedRoute && confirmedRoute.steps.length > 0) {
          const routeStepsPayload = confirmedRoute.steps.map((step) => ({
            voyage_id: voyage.id,
            order_num: step.order_num,
            name: step.name,
            from_port: step.from_port,
            to_port: step.to_port,
            from_lat: step.from_lat,
            from_lon: step.from_lon,
            to_lat: step.to_lat,
            to_lon: step.to_lon,
            distance_nm: step.distance_nm,
            distance_km: step.distance_km,
            phase: step.phase,
            notes: step.notes,
            status: 'to_do' as const,
          }))

          const { error: stepsError } = await supabase
            .from('route_steps')
            .insert(routeStepsPayload)

          if (stepsError)
            throw new Error(`Étapes de route : ${stepsError.message}`)
        }
      }

      // 5. Mark onboarding complete
      const { error: userError } = await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      if (userError)
        throw new Error(`Utilisateur : ${userError.message}`)

      // Redirect to dashboard
      router.push('/')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur inattendue'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  const totalSteps = STEPS.length
  const progressPercent = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header with step indicator */}
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Configuration
            </span>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {currentStep + 1}/{totalSteps}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step labels */}
        <div className="flex justify-between mt-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <div
                key={step.id}
                className={`flex items-center gap-1 text-xs ${
                  index === currentStep
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : index < currentStep
                      ? 'text-blue-400 dark:text-blue-600'
                      : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            )
          })}
        </div>
      </header>

      {/* Scrollable form area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-lg mx-auto">
          {currentStep === 0 && (
            <StepBoat data={boatData} onChange={setBoatData} />
          )}
          {currentStep === 1 && (
            <StepProfile data={profileData} onChange={setProfileData} />
          )}
          {currentStep === 2 && (
            <StepVoyage
              data={voyageData}
              onChange={setVoyageData}
              boatData={boatData}
              profileData={profileData}
              onRouteConfirmed={setConfirmedRoute}
            />
          )}
          {currentStep === 3 && (
            <StepDone
              boatData={boatData}
              profileData={profileData}
              voyageData={skippedVoyage ? { name: '', departure_port: '', arrival_port: '' } : voyageData}
            />
          )}
        </div>
      </main>

      {/* Bottom navigation */}
      <footer className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-4">
        <div className="max-w-lg mx-auto">
          {/* Save error */}
          {saveError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-3 text-center">
              {saveError}
            </p>
          )}

          <div className="flex gap-3">
            {/* Back button */}
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="h-[52px] px-5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium text-base transition-colors flex items-center justify-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700"
              >
                <ChevronLeft className="w-5 h-5" />
                Retour
              </button>
            )}

            {/* Skip voyage (only on step 2) */}
            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleSkipVoyage}
                className="h-[52px] px-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                Passer
              </button>
            )}

            {/* Next / Finish button */}
            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex-1 h-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold text-base transition-colors flex items-center justify-center gap-1"
              >
                Suivant
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 h-[52px] rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-400 dark:disabled:bg-green-800 text-white font-semibold text-base transition-colors flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Anchor className="w-5 h-5" />
                    Commencer l&apos;aventure
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
