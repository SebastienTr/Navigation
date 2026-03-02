'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Anchor, Crosshair, Loader2, MapPin } from 'lucide-react'
import { useActiveVoyage } from '@/lib/auth/hooks'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import MapLegend from './MapLegend'
import type { Database } from '@/lib/supabase/types'
import type { MapViewHandle } from './MapView'

type RouteStepRow = Database['public']['Tables']['route_steps']['Row']

// ── Leaflet dynamic import (SSR disabled) ────────────────────────────────────

const MapViewDynamic = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <LoadingSpinner text="Chargement de la carte..." size="lg" />
    </div>
  ),
})

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MapPage() {
  const { boatStatus, boat, voyage, loading: voyageLoading } = useActiveVoyage()
  const [routeSteps, setRouteSteps] = useState<RouteStepRow[]>([])
  const [stepsLoading, setStepsLoading] = useState(true)
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [locatingGps, setLocatingGps] = useState(false)
  const mapHandleRef = useRef<MapViewHandle | null>(null)

  // Fetch route steps
  useEffect(() => {
    if (!voyage) {
      setRouteSteps([])
      setStepsLoading(false)
      return
    }

    const fetchSteps = async () => {
      setStepsLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('route_steps')
        .select('*')
        .eq('voyage_id', voyage.id)
        .order('order_num', { ascending: true })
        .returns<RouteStepRow[]>()

      if (error) {
        console.error('Failed to fetch route steps:', error.message)
      } else {
        setRouteSteps(data ?? [])
      }
      setStepsLoading(false)
    }

    fetchSteps()
  }, [voyage])

  // GPS watchPosition — continuous tracking
  useEffect(() => {
    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        console.error('Geolocation watch error:', err.message)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Center on boat
  const handleCenterOnBoat = useCallback(() => {
    if (boatStatus?.current_lat != null && boatStatus?.current_lon != null) {
      mapHandleRef.current?.flyTo(boatStatus.current_lat, boatStatus.current_lon, 12)
    }
  }, [boatStatus])

  // Center on GPS
  const handleCenterOnGps = useCallback(() => {
    if (gpsPosition) {
      mapHandleRef.current?.flyTo(gpsPosition.lat, gpsPosition.lng, 13)
    } else if (navigator.geolocation) {
      setLocatingGps(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setGpsPosition(coords)
          mapHandleRef.current?.flyTo(coords.lat, coords.lng, 13)
          setLocatingGps(false)
        },
        (err) => {
          console.error('Geolocation error:', err.message)
          setLocatingGps(false)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }, [gpsPosition])

  if (voyageLoading || stepsLoading) {
    return (
      <div className="flex h-[calc(100dvh-5rem)] items-center justify-center">
        <LoadingSpinner text="Chargement..." size="lg" />
      </div>
    )
  }

  // Map center: boat position > GPS > France center
  const center = boatStatus?.current_lat && boatStatus?.current_lon
    ? { lat: boatStatus.current_lat, lng: boatStatus.current_lon }
    : gpsPosition ?? { lat: 46.6, lng: 2.0 }

  const defaultZoom = boatStatus?.current_lat ? 10 : 6
  const hasBoatPosition = boatStatus?.current_lat != null && boatStatus?.current_lon != null

  return (
    <div className="relative h-[calc(100dvh-5rem)]">
      <MapViewDynamic
        center={center}
        zoom={defaultZoom}
        routeSteps={routeSteps}
        boatLat={boatStatus?.current_lat ?? null}
        boatLon={boatStatus?.current_lon ?? null}
        boatName={boat?.name ?? null}
        navStatus={boatStatus?.nav_status ?? null}
        gpsLat={gpsPosition?.lat ?? null}
        gpsLon={gpsPosition?.lng ?? null}
        onMapReady={(handle) => { mapHandleRef.current = handle }}
      />

      {/* Legend (bottom-left) */}
      {routeSteps.length > 0 && <MapLegend />}

      {/* Floating center buttons (bottom-right, stacked) */}
      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-2">
        {/* Center on GPS */}
        {(gpsPosition || navigator.geolocation) && (
          <button
            type="button"
            onClick={handleCenterOnGps}
            disabled={locatingGps}
            aria-label="Centrer sur ma position GPS"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg transition-colors active:bg-gray-100 disabled:opacity-60 dark:bg-gray-800 dark:active:bg-gray-700"
          >
            {locatingGps ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-500 dark:text-gray-400" />
            ) : (
              <Crosshair className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        )}

        {/* Center on boat */}
        {hasBoatPosition && (
          <button
            type="button"
            onClick={handleCenterOnBoat}
            aria-label="Centrer sur le bateau"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg transition-colors active:bg-gray-100 dark:bg-gray-800 dark:active:bg-gray-700"
          >
            <Anchor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </button>
        )}
      </div>

      {/* No voyage indicator */}
      {!voyage && (
        <div className="absolute left-4 right-4 top-4 z-[1000] rounded-xl bg-white/90 p-3 text-center shadow-sm backdrop-blur dark:bg-gray-900/90">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="h-4 w-4" />
            <span>Aucun voyage actif</span>
          </div>
        </div>
      )}
    </div>
  )
}
