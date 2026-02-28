'use client'

import { useMemo, useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteStep } from './AIRouteWizard'

// Fix Leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── FitBounds component ────────────────────────────────────────────────

function FitBoundsToRoute({ steps }: { steps: RouteStep[] }) {
  const map = useMap()

  useEffect(() => {
    const points: L.LatLngExpression[] = []
    for (const step of steps) {
      if (step.from_lat != null && step.from_lon != null) {
        points.push([step.from_lat, step.from_lon])
      }
      if (step.to_lat != null && step.to_lon != null) {
        points.push([step.to_lat, step.to_lon])
      }
    }
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 })
    }
  }, [map, steps])

  return null
}

// ── Helpers ────────────────────────────────────────────────────────────

interface Waypoint {
  lat: number
  lon: number
  name: string
  isFirst: boolean
  isLast: boolean
}

function collectWaypoints(steps: RouteStep[]): Waypoint[] {
  const seen = new Set<string>()
  const waypoints: Waypoint[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.from_lat != null && step.from_lon != null) {
      const key = `${step.from_lat},${step.from_lon}`
      if (!seen.has(key)) {
        seen.add(key)
        waypoints.push({
          lat: step.from_lat,
          lon: step.from_lon,
          name: step.from_port,
          isFirst: i === 0,
          isLast: false,
        })
      }
    }
    if (step.to_lat != null && step.to_lon != null) {
      const key = `${step.to_lat},${step.to_lon}`
      if (!seen.has(key)) {
        seen.add(key)
        waypoints.push({
          lat: step.to_lat,
          lon: step.to_lon,
          name: step.to_port,
          isFirst: false,
          isLast: i === steps.length - 1,
        })
      }
    }
  }

  return waypoints
}

function buildPolyline(steps: RouteStep[]): L.LatLngExpression[] {
  const coords: L.LatLngExpression[] = []
  for (const step of steps) {
    if (step.from_lat != null && step.from_lon != null) {
      coords.push([step.from_lat, step.from_lon])
    }
    if (step.to_lat != null && step.to_lon != null) {
      coords.push([step.to_lat, step.to_lon])
    }
  }
  return coords
}

// ── Component ──────────────────────────────────────────────────────────

interface RoutePreviewMapProps {
  steps: RouteStep[]
}

export default function RoutePreviewMap({ steps }: RoutePreviewMapProps) {
  const waypoints = useMemo(() => collectWaypoints(steps), [steps])
  const polylineCoords = useMemo(() => buildPolyline(steps), [steps])

  // Default center (France)
  const defaultCenter: L.LatLngExpression = [46.5, 2.0]

  return (
    <div className="h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <MapContainer
        center={defaultCenter}
        zoom={5}
        zoomControl={false}
        className="h-full w-full"
        attributionControl={false}
      >
        <FitBoundsToRoute steps={steps} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        {/* Route polyline */}
        {polylineCoords.length >= 2 && (
          <Polyline
            positions={polylineCoords}
            pathOptions={{
              color: '#3B82F6',
              weight: 3,
              opacity: 0.85,
              dashArray: '8 6',
            }}
          />
        )}

        {/* Waypoint markers */}
        {waypoints.map((wp, i) => (
          <CircleMarker
            key={`wp-${i}`}
            center={[wp.lat, wp.lon]}
            radius={wp.isFirst || wp.isLast ? 7 : 4}
            pathOptions={{
              color: wp.isFirst ? '#22C55E' : wp.isLast ? '#EF4444' : '#1E40AF',
              fillColor: wp.isFirst ? '#BBF7D0' : wp.isLast ? '#FECACA' : '#DBEAFE',
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
              <span className="text-xs font-medium">{wp.name}</span>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
