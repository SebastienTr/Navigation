'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Database } from '@/lib/supabase/types'

type RouteStepRow = Database['public']['Tables']['route_steps']['Row']

// ── Fix Leaflet default icon issue in Next.js ────────────────────────────────

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Boat icon ────────────────────────────────────────────────────────────────

const boatIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 28px; height: 28px;
    background: #3B82F6;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

// ── Map controller: passes L.Map instance up via callback ────────────────────

function MapController({ onMapInstance }: { onMapInstance: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onMapInstance(map)
  }, [map, onMapInstance])
  return null
}

// ── Helper: build polyline segments by status ────────────────────────────────

interface RouteSegment {
  positions: L.LatLngExpression[]
  status: 'done' | 'in_progress' | 'to_do'
}

function buildRouteSegments(steps: RouteStepRow[]): RouteSegment[] {
  const segments: RouteSegment[] = []

  for (const step of steps) {
    if (
      step.from_lat == null ||
      step.from_lon == null ||
      step.to_lat == null ||
      step.to_lon == null
    ) {
      continue
    }

    segments.push({
      positions: [
        [step.from_lat, step.from_lon],
        [step.to_lat, step.to_lon],
      ],
      status: step.status,
    })
  }

  return segments
}

// ── Helper: collect unique waypoints ─────────────────────────────────────────

interface Waypoint {
  lat: number
  lon: number
  name: string
}

function collectWaypoints(steps: RouteStepRow[]): Waypoint[] {
  const seen = new Set<string>()
  const waypoints: Waypoint[] = []

  for (const step of steps) {
    if (step.from_lat != null && step.from_lon != null) {
      const key = `${step.from_lat},${step.from_lon}`
      if (!seen.has(key)) {
        seen.add(key)
        waypoints.push({ lat: step.from_lat, lon: step.from_lon, name: step.from_port })
      }
    }
    if (step.to_lat != null && step.to_lon != null) {
      const key = `${step.to_lat},${step.to_lon}`
      if (!seen.has(key)) {
        seen.add(key)
        waypoints.push({ lat: step.to_lat, lon: step.to_lon, name: step.to_port })
      }
    }
  }

  return waypoints
}

// ── Style helpers ────────────────────────────────────────────────────────────

function getSegmentColor(status: RouteSegment['status']): string {
  switch (status) {
    case 'done':
      return '#9CA3AF'
    case 'in_progress':
      return '#3B82F6'
    case 'to_do':
      return '#3B82F6'
  }
}

function getSegmentDash(status: RouteSegment['status']): string | undefined {
  return status === 'to_do' ? '8 6' : undefined
}

// ── Exported handle type ─────────────────────────────────────────────────────

export interface MapViewHandle {
  flyTo: (lat: number, lng: number, zoom: number) => void
}

// ── MapView component ────────────────────────────────────────────────────────

interface MapViewProps {
  center: { lat: number; lng: number }
  zoom: number
  routeSteps: RouteStepRow[]
  boatLat: number | null
  boatLon: number | null
  onMapReady?: (handle: MapViewHandle) => void
}

export default function MapView({
  center,
  zoom,
  routeSteps,
  boatLat,
  boatLon,
  onMapReady,
}: MapViewProps) {
  const mapInstanceRef = useRef<L.Map | null>(null)

  const handleMapInstance = useCallback(
    (map: L.Map) => {
      mapInstanceRef.current = map
      onMapReady?.({
        flyTo(lat: number, lng: number, z: number) {
          map.flyTo([lat, lng], z, { duration: 1 })
        },
      })
    },
    [onMapReady]
  )

  const segments = useMemo(() => buildRouteSegments(routeSteps), [routeSteps])
  const waypoints = useMemo(() => collectWaypoints(routeSteps), [routeSteps])

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={false}
      className="h-full w-full"
      attributionControl={false}
    >
      <MapController onMapInstance={handleMapInstance} />

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <TileLayer
        url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
        opacity={0.8}
      />

      {/* Route polylines by status */}
      {segments.map((seg, i) => (
        <Polyline
          key={`seg-${i}`}
          positions={seg.positions}
          pathOptions={{
            color: getSegmentColor(seg.status),
            weight: seg.status === 'in_progress' ? 4 : 3,
            opacity: seg.status === 'done' ? 0.5 : 0.85,
            dashArray: getSegmentDash(seg.status),
          }}
        />
      ))}

      {/* Waypoint markers */}
      {waypoints.map((wp, i) => (
        <CircleMarker
          key={`wp-${i}`}
          center={[wp.lat, wp.lon]}
          radius={5}
          pathOptions={{
            color: '#1E40AF',
            fillColor: '#DBEAFE',
            fillOpacity: 1,
            weight: 2,
          }}
        >
          <Popup>
            <span className="text-sm font-medium">{wp.name}</span>
          </Popup>
        </CircleMarker>
      ))}

      {/* Boat position marker */}
      {boatLat != null && boatLon != null && (
        <Marker position={[boatLat, boatLon]} icon={boatIcon}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">Position actuelle</p>
              <p className="text-xs text-gray-500">
                {boatLat.toFixed(4)}, {boatLon.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
