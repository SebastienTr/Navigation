'use client'

import { useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Database } from '@/lib/supabase/types'

type RouteStepRow = Database['public']['Tables']['route_steps']['Row']

const boatIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 20px; height: 20px;
    background: #3B82F6;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

interface RouteSegment {
  positions: L.LatLngExpression[]
  status: 'done' | 'in_progress' | 'to_do'
}

function buildRouteSegments(steps: RouteStepRow[]): RouteSegment[] {
  const segments: RouteSegment[] = []
  for (const step of steps) {
    if (step.from_lat == null || step.from_lon == null || step.to_lat == null || step.to_lon == null) continue
    segments.push({
      positions: [[step.from_lat, step.from_lon], [step.to_lat, step.to_lon]],
      status: step.status,
    })
  }
  return segments
}

function getSegmentColor(status: RouteSegment['status']): string {
  return status === 'done' ? '#9CA3AF' : '#3B82F6'
}

interface MiniMapViewProps {
  routeSteps: RouteStepRow[]
  boatLat: number | null
  boatLon: number | null
}

export default function MiniMapView({ routeSteps, boatLat, boatLon }: MiniMapViewProps) {
  const segments = useMemo(() => buildRouteSegments(routeSteps), [routeSteps])

  const center = useMemo((): [number, number] => {
    if (boatLat != null && boatLon != null) return [boatLat, boatLon]
    if (routeSteps.length > 0) {
      const first = routeSteps[0]
      if (first.from_lat != null && first.from_lon != null) return [first.from_lat, first.from_lon]
    }
    return [46.5, 2.5] // France center fallback
  }, [boatLat, boatLon, routeSteps])

  return (
    <MapContainer
      center={center}
      zoom={6}
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      attributionControl={false}
      className="h-full w-full rounded-lg"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="base-tiles" />
      <TileLayer url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png" opacity={0.8} className="seamark-tiles" />

      {segments.map((seg, i) => (
        <Polyline
          key={`seg-${i}`}
          positions={seg.positions}
          pathOptions={{
            color: getSegmentColor(seg.status),
            weight: seg.status === 'in_progress' ? 3 : 2,
            opacity: seg.status === 'done' ? 0.5 : 0.85,
            dashArray: seg.status === 'to_do' ? '6 4' : undefined,
          }}
        />
      ))}

      {boatLat != null && boatLon != null && (
        <Marker position={[boatLat, boatLon]} icon={boatIcon} />
      )}
    </MapContainer>
  )
}
