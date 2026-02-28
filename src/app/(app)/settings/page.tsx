'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Ship,
  User,
  Navigation,
  LogOut,
  Trash2,
  Plus,
  Save,
  Loader2,
  Check,
  AlertTriangle,
  Bell,
  BellOff,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useUser, useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'

type BoatRow = Database['public']['Tables']['boats']['Row']
type BoatInsert = Database['public']['Tables']['boats']['Insert']
type NavProfileRow = Database['public']['Tables']['nav_profiles']['Row']
type VoyageRow = Database['public']['Tables']['voyages']['Row']

// ── Accordion Section ───────────────────────────────────────────────────────

function AccordionSection({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[52px] w-full items-center justify-between px-4 py-3 text-left active:bg-gray-50 dark:active:bg-gray-800/50"
      >
        <div className="flex items-center gap-3">
          <Icon size={20} className="text-blue-600 dark:text-blue-400" />
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown size={20} className="text-gray-400" />
        ) : (
          <ChevronRight size={20} className="text-gray-400" />
        )}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VoyageRow['status'] }) {
  const config = {
    active: { label: 'Actif', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    planning: { label: 'Planification', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    completed: { label: 'Terminé', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  }
  const { label, className } = config[status]

  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

// ── Save Button ─────────────────────────────────────────────────────────────

function SaveButton({
  loading,
  saved,
  onClick,
  label = 'Sauvegarder',
}: {
  loading: boolean
  saved: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors',
        saved
          ? 'bg-green-600'
          : 'bg-blue-600 active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600',
        loading && 'opacity-60'
      )}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : saved ? (
        <Check size={16} />
      ) : (
        <Save size={16} />
      )}
      {saved ? 'Sauvegardé' : label}
    </button>
  )
}

// ── Form Field Wrapper ──────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500'

const selectClass =
  'w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'

const checkboxClass =
  'h-5 w-5 rounded border-gray-300 text-blue-600 dark:border-gray-600'

// ── Boat Form ───────────────────────────────────────────────────────────────

interface BoatFormData {
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

function boatToFormData(boat: BoatRow | null): BoatFormData {
  return {
    name: boat?.name ?? '',
    type: boat?.type ?? '',
    length_m: boat?.length_m?.toString() ?? '',
    draft_m: boat?.draft_m?.toString() ?? '',
    air_draft_m: boat?.air_draft_m?.toString() ?? '',
    engine_type: boat?.engine_type ?? '',
    fuel_capacity_hours: boat?.fuel_capacity_hours?.toString() ?? '',
    avg_speed_kn: boat?.avg_speed_kn?.toString() ?? '',
    has_ais_tx: boat?.has_ais_tx ?? false,
    has_autopilot: boat?.has_autopilot ?? false,
    has_radar: boat?.has_radar ?? false,
    has_watermaker: boat?.has_watermaker ?? false,
  }
}

function BoatForm({
  boat,
  userId,
  onSaved,
}: {
  boat: BoatRow | null
  userId: string
  onSaved: () => void
}) {
  const [form, setForm] = useState<BoatFormData>(boatToFormData(boat))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync form when boat data arrives or changes
  const prevBoatId = useRef(boat?.id)
  useEffect(() => {
    if (boat && boat.id !== prevBoatId.current) {
      prevBoatId.current = boat.id
      setForm(boatToFormData(boat))
    }
  }, [boat])

  const updateField = <K extends keyof BoatFormData>(
    key: K,
    value: BoatFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Le nom du bateau est requis.')
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createClient()

    const payload: BoatInsert = {
      user_id: userId,
      name: form.name.trim(),
      type: form.type || null,
      length_m: form.length_m ? parseFloat(form.length_m) : null,
      draft_m: form.draft_m ? parseFloat(form.draft_m) : null,
      air_draft_m: form.air_draft_m ? parseFloat(form.air_draft_m) : null,
      engine_type: form.engine_type || null,
      fuel_capacity_hours: form.fuel_capacity_hours
        ? parseFloat(form.fuel_capacity_hours)
        : null,
      avg_speed_kn: form.avg_speed_kn ? parseFloat(form.avg_speed_kn) : null,
      has_ais_tx: form.has_ais_tx,
      has_autopilot: form.has_autopilot,
      has_radar: form.has_radar,
      has_watermaker: form.has_watermaker,
    }

    if (boat) {
      // Update existing boat
      const { error: updateError } = await supabase
        .from('boats')
        .update(payload)
        .eq('id', boat.id)
        .eq('user_id', userId)

      if (updateError) {
        setError(`Erreur de sauvegarde : ${updateError.message}`)
      } else {
        setSaved(true)
        onSaved()
      }
    } else {
      // Insert new boat
      const { error: insertError } = await supabase
        .from('boats')
        .insert(payload)

      if (insertError) {
        setError(`Erreur de création : ${insertError.message}`)
      } else {
        setSaved(true)
        onSaved()
      }
    }

    setSaving(false)
  }

  return (
    <div className="space-y-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nom du bateau">
          <input
            type="text"
            className={inputClass}
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Ex: Laurine"
          />
        </Field>

        <Field label="Type">
          <input
            type="text"
            className={inputClass}
            value={form.type}
            onChange={(e) => updateField('type', e.target.value)}
            placeholder="Ex: Laurin Koster 28"
          />
        </Field>

        <Field label="Longueur (m)">
          <input
            type="number"
            step="0.1"
            className={inputClass}
            value={form.length_m}
            onChange={(e) => updateField('length_m', e.target.value)}
            placeholder="Ex: 8.5"
          />
        </Field>

        <Field label="Tirant d'eau (m)">
          <input
            type="number"
            step="0.01"
            className={inputClass}
            value={form.draft_m}
            onChange={(e) => updateField('draft_m', e.target.value)}
            placeholder="Ex: 1.45"
          />
        </Field>

        <Field label="Tirant d'air (m)">
          <input
            type="number"
            step="0.1"
            className={inputClass}
            value={form.air_draft_m}
            onChange={(e) => updateField('air_draft_m', e.target.value)}
            placeholder="Ex: 12"
          />
        </Field>

        <Field label="Moteur">
          <select
            className={selectClass}
            value={form.engine_type}
            onChange={(e) => updateField('engine_type', e.target.value)}
          >
            <option value="">Non renseigné</option>
            <option value="Diesel">Diesel</option>
            <option value="Essence">Essence</option>
            <option value="Électrique">Électrique</option>
            <option value="Hybride">Hybride</option>
            <option value="Voile seule">Voile seule</option>
          </select>
        </Field>

        <Field label="Autonomie carburant (h)">
          <input
            type="number"
            step="1"
            className={inputClass}
            value={form.fuel_capacity_hours}
            onChange={(e) => updateField('fuel_capacity_hours', e.target.value)}
            placeholder="Ex: 40"
          />
        </Field>

        <Field label="Vitesse moyenne (kn)">
          <input
            type="number"
            step="0.1"
            className={inputClass}
            value={form.avg_speed_kn}
            onChange={(e) => updateField('avg_speed_kn', e.target.value)}
            placeholder="Ex: 4.5"
          />
        </Field>
      </div>

      <div className="space-y-3 pt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Équipement
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-h-[44px] items-center gap-2.5">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={form.has_ais_tx}
              onChange={(e) => updateField('has_ais_tx', e.target.checked)}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              AIS émetteur
            </span>
          </label>
          <label className="flex min-h-[44px] items-center gap-2.5">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={form.has_autopilot}
              onChange={(e) => updateField('has_autopilot', e.target.checked)}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Pilote auto
            </span>
          </label>
          <label className="flex min-h-[44px] items-center gap-2.5">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={form.has_radar}
              onChange={(e) => updateField('has_radar', e.target.checked)}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Radar
            </span>
          </label>
          <label className="flex min-h-[44px] items-center gap-2.5">
            <input
              type="checkbox"
              className={checkboxClass}
              checked={form.has_watermaker}
              onChange={(e) => updateField('has_watermaker', e.target.checked)}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Dessalinisateur
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <SaveButton loading={saving} saved={saved} onClick={handleSave} />
    </div>
  )
}

// ── Profile Form ────────────────────────────────────────────────────────────

function ProfileForm({
  profile,
  userId,
  onSaved,
}: {
  profile: NavProfileRow | null
  userId: string
  onSaved: () => void
}) {
  const [experience, setExperience] = useState<string>(
    profile?.experience ?? ''
  )
  const [crewMode, setCrewMode] = useState<string>(profile?.crew_mode ?? '')
  const [riskTolerance, setRiskTolerance] = useState<string>(
    profile?.risk_tolerance ?? ''
  )
  const [nightSailing, setNightSailing] = useState<string>(
    profile?.night_sailing ?? ''
  )
  const [maxHours, setMaxHours] = useState<string>(
    profile?.max_continuous_hours?.toString() ?? ''
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync state when profile data arrives async
  const prevProfileId = useRef(profile?.id)
  useEffect(() => {
    if (profile && profile.id !== prevProfileId.current) {
      prevProfileId.current = profile.id
      setExperience(profile.experience ?? '')
      setCrewMode(profile.crew_mode ?? '')
      setRiskTolerance(profile.risk_tolerance ?? '')
      setNightSailing(profile.night_sailing ?? '')
      setMaxHours(profile.max_continuous_hours?.toString() ?? '')
    }
  }, [profile])

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const supabase = createClient()

    const payload = {
      user_id: userId,
      experience: (experience || null) as NavProfileRow['experience'],
      crew_mode: (crewMode || null) as NavProfileRow['crew_mode'],
      risk_tolerance: (riskTolerance || null) as NavProfileRow['risk_tolerance'],
      night_sailing: (nightSailing || null) as NavProfileRow['night_sailing'],
      max_continuous_hours: maxHours ? parseFloat(maxHours) : null,
    }

    if (profile) {
      const { error: updateError } = await supabase
        .from('nav_profiles')
        .update(payload)
        .eq('id', profile.id)
        .eq('user_id', userId)

      if (updateError) {
        setError(`Erreur de sauvegarde : ${updateError.message}`)
      } else {
        setSaved(true)
        onSaved()
      }
    } else {
      const { error: insertError } = await supabase
        .from('nav_profiles')
        .insert(payload)

      if (insertError) {
        setError(`Erreur de création : ${insertError.message}`)
      } else {
        setSaved(true)
        onSaved()
      }
    }

    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Expérience">
          <select
            className={selectClass}
            value={experience}
            onChange={(e) => {
              setExperience(e.target.value)
              setSaved(false)
            }}
          >
            <option value="">Non renseigné</option>
            <option value="Beginner">Débutant</option>
            <option value="Intermediate">Intermédiaire</option>
            <option value="Experienced">Expérimenté</option>
            <option value="Pro">Professionnel</option>
          </select>
        </Field>

        <Field label="Mode équipage">
          <select
            className={selectClass}
            value={crewMode}
            onChange={(e) => {
              setCrewMode(e.target.value)
              setSaved(false)
            }}
          >
            <option value="">Non renseigné</option>
            <option value="Solo">Solo</option>
            <option value="Duo">Duo</option>
            <option value="Family">Famille</option>
            <option value="Full crew">Équipage complet</option>
          </select>
        </Field>

        <Field label="Tolérance au risque">
          <select
            className={selectClass}
            value={riskTolerance}
            onChange={(e) => {
              setRiskTolerance(e.target.value)
              setSaved(false)
            }}
          >
            <option value="">Non renseigné</option>
            <option value="Cautious">Prudent</option>
            <option value="Moderate">Modéré</option>
            <option value="Bold">Audacieux</option>
          </select>
        </Field>

        <Field label="Navigation de nuit">
          <select
            className={selectClass}
            value={nightSailing}
            onChange={(e) => {
              setNightSailing(e.target.value)
              setSaved(false)
            }}
          >
            <option value="">Non renseigné</option>
            <option value="No">Non</option>
            <option value="Yes">Oui</option>
            <option value="Only if necessary">Si nécessaire</option>
          </select>
        </Field>

        <Field label="Heures continues max">
          <input
            type="number"
            step="1"
            className={inputClass}
            value={maxHours}
            onChange={(e) => {
              setMaxHours(e.target.value)
              setSaved(false)
            }}
            placeholder="Ex: 12"
          />
        </Field>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <SaveButton loading={saving} saved={saved} onClick={handleSave} />
    </div>
  )
}

// ── Voyage Form (new voyage) ────────────────────────────────────────────────

function NewVoyageForm({
  userId,
  boats,
  navProfiles,
  onCreated,
  onCancel,
}: {
  userId: string
  boats: BoatRow[]
  navProfiles: NavProfileRow[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [boatId, setBoatId] = useState(boats[0]?.id ?? '')
  const [profileId, setProfileId] = useState(navProfiles[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Le nom du voyage est requis.')
      return
    }
    if (!boatId) {
      setError('Sélectionnez un bateau.')
      return
    }

    setSaving(true)
    setError(null)

    const supabase = createClient()

    const { data: voyage, error: voyageError } = await supabase
      .from('voyages')
      .insert({
        user_id: userId,
        boat_id: boatId,
        nav_profile_id: profileId || null,
        name: name.trim(),
        status: 'planning' as const,
      })
      .select()
      .returns<VoyageRow[]>()
      .single()

    if (voyageError || !voyage) {
      setError(`Erreur de création : ${voyageError?.message ?? 'Erreur inconnue'}`)
      setSaving(false)
      return
    }

    // Initialize boat_status for the voyage
    const { error: statusError } = await supabase
      .from('boat_status')
      .insert({
        voyage_id: voyage.id,
        nav_status: 'in_port' as const,
      })

    if (statusError) {
      console.error('Erreur création boat_status:', statusError.message)
    }

    setSaving(false)
    onCreated()
  }

  return (
    <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/10">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Nouveau voyage
      </h4>

      <Field label="Nom du voyage">
        <input
          type="text"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Audierne - Nice 2026"
        />
      </Field>

      <Field label="Bateau">
        <select
          className={selectClass}
          value={boatId}
          onChange={(e) => setBoatId(e.target.value)}
        >
          {boats.length === 0 && (
            <option value="">Aucun bateau configuré</option>
          )}
          {boats.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.type ? ` (${b.type})` : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Profil navigateur">
        <select
          className={selectClass}
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
        >
          <option value="">Aucun</option>
          {navProfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.experience ?? 'Profil'} / {p.crew_mode ?? '-'}
            </option>
          ))}
        </select>
      </Field>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          Créer le voyage
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:active:bg-gray-800"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── Delete Account Dialog ───────────────────────────────────────────────────

function DeleteAccountDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const [confirmation, setConfirmation] = useState('')

  return (
    <div className="space-y-4 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-800 dark:bg-red-900/10">
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={20}
          className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
        />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            Supprimer mon compte
          </p>
          <p className="text-sm text-red-700 dark:text-red-400">
            Cette action est irreversible. Toutes vos données (bateaux, voyages,
            journal, briefings) seront supprimées définitivement.
          </p>
          <p className="text-sm text-red-700 dark:text-red-400">
            Tapez <strong>SUPPRIMER</strong> pour confirmer :
          </p>
          <input
            type="text"
            className={cn(inputClass, 'border-red-300 dark:border-red-700')}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="SUPPRIMER"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmation !== 'SUPPRIMER'}
          className={cn(
            'flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white',
            confirmation === 'SUPPRIMER'
              ? 'bg-red-600 active:bg-red-700'
              : 'cursor-not-allowed bg-red-300 dark:bg-red-900'
          )}
        >
          <Trash2 size={16} />
          Confirmer la suppression
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:active:bg-gray-800"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

// ── Main Settings Page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { profile, loading: profileLoading } = useUser()
  const { voyage: activeVoyage, loading: voyageLoading } = useActiveVoyage()

  // Data state
  const [boats, setBoats] = useState<BoatRow[]>([])
  const [navProfiles, setNavProfiles] = useState<NavProfileRow[]>([])
  const [voyages, setVoyages] = useState<VoyageRow[]>([])
  const [loading, setLoading] = useState(true)

  // Push notifications
  const { isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications()

  // UI state
  const [openSection, setOpenSection] = useState<string | null>('boat')
  const [editingBoatId, setEditingBoatId] = useState<string | null>(null)
  const [addingBoat, setAddingBoat] = useState(false)
  const [addingVoyage, setAddingVoyage] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)

  // Fetch all settings data
  const fetchData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    const supabase = createClient()

    const [boatsResult, profilesResult, voyagesResult] = await Promise.all([
      supabase
        .from('boats')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .returns<BoatRow[]>(),
      supabase
        .from('nav_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .returns<NavProfileRow[]>(),
      supabase
        .from('voyages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .returns<VoyageRow[]>(),
    ])

    if (boatsResult.data) setBoats(boatsResult.data)
    if (profilesResult.data) setNavProfiles(profilesResult.data)
    if (voyagesResult.data) setVoyages(voyagesResult.data)

    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleSection = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const handleActivateVoyage = async (voyageId: string) => {
    if (!user) return

    setActivating(voyageId)
    const supabase = createClient()

    // Set all voyages to planning first
    await supabase
      .from('voyages')
      .update({ status: 'planning' as const })
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Then set the selected one to active
    await supabase
      .from('voyages')
      .update({ status: 'active' as const })
      .eq('id', voyageId)
      .eq('user_id', user.id)

    setActivating(null)
    fetchData()
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    const supabase = createClient()

    // Delete user data (cascade should handle related data through DB constraints)
    // But we explicitly delete the auth user
    const { error } = await supabase.auth.admin.deleteUser(user.id)

    if (error) {
      // If admin delete fails (likely on client-side), sign out instead
      console.error('Could not delete account:', error.message)
      await signOut()
    } else {
      await signOut()
    }

    router.push('/login')
  }

  if (profileLoading || voyageLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Chargement des paramètres...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="px-4 pb-2 pt-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gérez votre bateau, profil et voyages
        </p>
      </div>

      <div className="divide-y divide-gray-200 rounded-xl bg-white shadow-sm dark:divide-gray-800 dark:bg-gray-900">
        {/* ── Section: Mon Bateau ─────────────────────────────────────── */}
        <AccordionSection
          title="Mon Bateau"
          icon={Ship}
          isOpen={openSection === 'boat'}
          onToggle={() => toggleSection('boat')}
        >
          <div className="space-y-4">
            {boats.map((boat) => (
              <div key={boat.id}>
                <button
                  type="button"
                  onClick={() =>
                    setEditingBoatId(
                      editingBoatId === boat.id ? null : boat.id
                    )
                  }
                  className="flex min-h-[44px] w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-left active:bg-gray-100 dark:bg-gray-800/50 dark:active:bg-gray-800"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {boat.name}
                    </span>
                    {boat.type && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {boat.type}
                      </span>
                    )}
                  </div>
                  {editingBoatId === boat.id ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </button>
                {editingBoatId === boat.id && (
                  <div className="mt-2">
                    <BoatForm
                      boat={boat}
                      userId={user?.id ?? ''}
                      onSaved={fetchData}
                    />
                  </div>
                )}
              </div>
            ))}

            {boats.length === 0 && !addingBoat && (
              <p className="py-2 text-sm text-gray-500 dark:text-gray-400">
                Aucun bateau configuré.
              </p>
            )}

            {addingBoat ? (
              <div>
                <BoatForm
                  boat={null}
                  userId={user?.id ?? ''}
                  onSaved={() => {
                    setAddingBoat(false)
                    fetchData()
                  }}
                />
                <button
                  type="button"
                  onClick={() => setAddingBoat(false)}
                  className="mt-2 text-sm text-gray-500 active:text-gray-700 dark:text-gray-400"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingBoat(true)}
                className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-blue-600 active:text-blue-700 dark:text-blue-400 dark:active:text-blue-300"
              >
                <Plus size={16} />
                Ajouter un bateau
              </button>
            )}
          </div>
        </AccordionSection>

        {/* ── Section: Mon Profil ──────────────────────────────────────── */}
        <AccordionSection
          title="Mon Profil"
          icon={User}
          isOpen={openSection === 'profile'}
          onToggle={() => toggleSection('profile')}
        >
          <ProfileForm
            profile={navProfiles[0] ?? null}
            userId={user?.id ?? ''}
            onSaved={fetchData}
          />
        </AccordionSection>

        {/* ── Section: Mes Voyages ─────────────────────────────────────── */}
        <AccordionSection
          title="Mes Voyages"
          icon={Navigation}
          isOpen={openSection === 'voyages'}
          onToggle={() => toggleSection('voyages')}
        >
          <div className="space-y-3">
            {voyages.map((voyage) => {
              const boatForVoyage = boats.find(
                (b) => b.id === voyage.boat_id
              )
              const isActive = voyage.status === 'active'
              const isActivating = activating === voyage.id

              return (
                <div
                  key={voyage.id}
                  className={cn(
                    'rounded-lg border p-3',
                    isActive
                      ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {voyage.name}
                        </span>
                        <StatusBadge status={voyage.status} />
                      </div>
                      {boatForVoyage && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {boatForVoyage.name}
                          {boatForVoyage.type
                            ? ` (${boatForVoyage.type})`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isActive && voyage.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => handleActivateVoyage(voyage.id)}
                      disabled={isActivating}
                      className="mt-2 flex min-h-[36px] items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white active:bg-green-700"
                    >
                      {isActivating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      Activer
                    </button>
                  )}
                </div>
              )
            })}

            {voyages.length === 0 && !addingVoyage && (
              <p className="py-2 text-sm text-gray-500 dark:text-gray-400">
                Aucun voyage configuré.
              </p>
            )}

            {addingVoyage ? (
              <NewVoyageForm
                userId={user?.id ?? ''}
                boats={boats}
                navProfiles={navProfiles}
                onCreated={() => {
                  setAddingVoyage(false)
                  fetchData()
                }}
                onCancel={() => setAddingVoyage(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingVoyage(true)}
                className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-blue-600 active:text-blue-700 dark:text-blue-400 dark:active:text-blue-300"
              >
                <Plus size={16} />
                Nouveau voyage
              </button>
            )}
          </div>
        </AccordionSection>

        {/* ── Section: Notifications ──────────────────────────────────── */}
        <AccordionSection
          title="Notifications"
          icon={Bell}
          isOpen={openSection === 'notifications'}
          onToggle={() => toggleSection('notifications')}
        >
          <div className="space-y-3">
            {isSupported ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Recevez des alertes météo, rappels et briefings directement sur votre appareil.
                </p>
                {isSubscribed ? (
                  <button
                    type="button"
                    onClick={unsubscribe}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:active:bg-gray-800"
                  >
                    <BellOff size={16} />
                    Désactiver les notifications
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={subscribe}
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white active:bg-blue-700 dark:bg-blue-500 dark:active:bg-blue-600"
                  >
                    <Bell size={16} />
                    Activer les notifications
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Les notifications push ne sont pas supportées par ce navigateur.
              </p>
            )}
          </div>
        </AccordionSection>

        {/* ── Section: Compte ──────────────────────────────────────────── */}
        <AccordionSection
          title="Compte"
          icon={LogOut}
          isOpen={openSection === 'account'}
          onToggle={() => toggleSection('account')}
        >
          <div className="space-y-4">
            {/* Email display */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Email
              </p>
              <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                {user?.email ?? '-'}
              </p>
            </div>

            {/* Name display */}
            {profile?.name && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Nom
                </p>
                <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                  {profile.name}
                </p>
              </div>
            )}

            {/* Active voyage indicator */}
            {activeVoyage && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Voyage actif
                </p>
                <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                  {activeVoyage.name}
                </p>
              </div>
            )}

            {/* Sign out */}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:active:bg-gray-800"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>

            {/* Delete account */}
            {showDeleteConfirm ? (
              <DeleteAccountDialog
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteConfirm(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 active:bg-red-50 dark:border-red-700 dark:text-red-400 dark:active:bg-red-900/20"
              >
                <Trash2 size={16} />
                Supprimer mon compte
              </button>
            )}
          </div>
        </AccordionSection>
      </div>

      {/* Bottom spacing for nav bar */}
      <div className="h-8" />
    </div>
  )
}
