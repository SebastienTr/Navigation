'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './context'
import type { Database } from '@/lib/supabase/types'

type UserRow = Database['public']['Tables']['users']['Row']
type VoyageRow = Database['public']['Tables']['voyages']['Row']
type BoatRow = Database['public']['Tables']['boats']['Row']
type NavProfileRow = Database['public']['Tables']['nav_profiles']['Row']
type BoatStatusRow = Database['public']['Tables']['boat_status']['Row']

// ── useUser ────────────────────────────────────────────────────────────

interface UseUserReturn {
  profile: UserRow | null
  loading: boolean
}

export function useUser(): UseUserReturn {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }

    const fetchProfile = async () => {
      setLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .returns<UserRow[]>()
        .single()

      if (error) {
        console.error('Failed to fetch user profile:', error.message)
        setProfile(null)
      } else {
        setProfile(data)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [user])

  return { profile, loading }
}

// ── useActiveVoyage ────────────────────────────────────────────────────

interface UseActiveVoyageReturn {
  voyage: VoyageRow | null
  boat: BoatRow | null
  navProfile: NavProfileRow | null
  boatStatus: BoatStatusRow | null
  loading: boolean
}

export function useActiveVoyage(): UseActiveVoyageReturn {
  const { user } = useAuth()
  const [voyage, setVoyage] = useState<VoyageRow | null>(null)
  const [boat, setBoat] = useState<BoatRow | null>(null)
  const [navProfile, setNavProfile] = useState<NavProfileRow | null>(null)
  const [boatStatus, setBoatStatus] = useState<BoatStatusRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setVoyage(null)
      setBoat(null)
      setNavProfile(null)
      setBoatStatus(null)
      setLoading(false)
      return
    }

    const fetchActiveVoyage = async () => {
      setLoading(true)
      const supabase = createClient()

      // Fetch the active voyage for this user
      const { data: voyageData, error: voyageError } = await supabase
        .from('voyages')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .returns<VoyageRow[]>()
        .maybeSingle()

      if (voyageError) {
        console.error('Failed to fetch active voyage:', voyageError.message)
        setLoading(false)
        return
      }

      if (!voyageData) {
        setVoyage(null)
        setBoat(null)
        setNavProfile(null)
        setBoatStatus(null)
        setLoading(false)
        return
      }

      setVoyage(voyageData)

      // Fetch boat, nav profile, and boat status in parallel
      const [boatResult, navProfileResult, boatStatusResult] =
        await Promise.all([
          supabase
            .from('boats')
            .select('*')
            .eq('id', voyageData.boat_id)
            .returns<BoatRow[]>()
            .single(),
          voyageData.nav_profile_id
            ? supabase
                .from('nav_profiles')
                .select('*')
                .eq('id', voyageData.nav_profile_id)
                .returns<NavProfileRow[]>()
                .single()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from('boat_status')
            .select('*')
            .eq('voyage_id', voyageData.id)
            .returns<BoatStatusRow[]>()
            .single(),
        ])

      if (boatResult.error) {
        console.error('Failed to fetch boat:', boatResult.error.message)
      } else {
        setBoat(boatResult.data)
      }

      if (navProfileResult.error) {
        console.error(
          'Failed to fetch nav profile:',
          navProfileResult.error.message
        )
      } else {
        setNavProfile(navProfileResult.data)
      }

      if (boatStatusResult.error) {
        console.error(
          'Failed to fetch boat status:',
          boatStatusResult.error.message
        )
      } else {
        setBoatStatus(boatStatusResult.data)
      }

      setLoading(false)
    }

    fetchActiveVoyage()
  }, [user])

  return { voyage, boat, navProfile, boatStatus, loading }
}
