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

// ── Helpers ────────────────────────────────────────────────────────────

function isValidCoord(lat: number | null, lon: number | null): lat is number {
  return lat != null && lon != null && isFinite(lat) && isFinite(lon)
}

interface Waypoint {
  lat: number
  lon: number
  name: string
  isFirst: boolean
  isLast: boolean
}

// ── FitBounds component ────────────────────────────────────────────────

function FitBoundsToRoute({ steps }: { steps: RouteStep[] }) {
  const map = useMap()

  useEffect(() => {
    const points: L.LatLngExpression[] = []
    for (const step of steps) {
      if (isValidCoord(step.from_lat, step.from_lon)) {
        points.push([step.from_lat, step.from_lon!])
      }
      if (isValidCoord(step.to_lat, step.to_lon)) {
        points.push([step.to_lat, step.to_lon!])
      }
    }
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 10 })
    }
  }, [map, steps])

  return null
}

function collectWaypoints(steps: RouteStep[]): Waypoint[] {
  const seen = new Set<string>()
  const waypoints: Waypoint[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (isValidCoord(step.from_lat, step.from_lon)) {
      const key = `${step.from_lat},${step.from_lon}`
      if (!seen.has(key)) {
        seen.add(key)
        waypoints.push({
          lat: step.from_lat,
          lon: step.from_lon!,
          name: step.from_port,
          isFirst: i === 0,
          isLast: false,
        })
      }
    }
    if (isValidCoord(step.to_lat, step.to_lon)) {
      const key = `${step.to_lat},${step.to_lon}`
      if (!seen.has(key)) {
        seen.add(key)
        waypoints.push({
          lat: step.to_lat,
          lon: step.to_lon!,
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
    if (isValidCoord(step.from_lat, step.from_lon)) {
      coords.push([step.from_lat, step.from_lon!])
    }
    if (isValidCoord(step.to_lat, step.to_lon)) {
      coords.push([step.to_lat, step.to_lon!])
    }
  }
  return coords
}

// ── Constants ─────────────────────────────────────────────────────────

const ROUTE_COLORS = [
  { line: '#3B82F6', marker: '#1E40AF', fill: '#DBEAFE' },  // blue
  { line: '#F59E0B', marker: '#B45309', fill: '#FEF3C7' },  // amber
  { line: '#10B981', marker: '#047857', fill: '#D1FAE5' },  // emerald
  { line: '#8B5CF6', marker: '#6D28D9', fill: '#EDE9FE' },  // violet
]

// ── Component ──────────────────────────────────────────────────────────

interface RoutePreviewMapProps {
  steps: RouteStep[]
  overlay?: React.ReactNode
  additionalRoutes?: RouteStep[][]
}

export default function RoutePreviewMap({ steps, overlay, additionalRoutes }: RoutePreviewMapProps) {
  const waypoints = useMemo(() => collectWaypoints(steps), [steps])
  const polylineCoords = useMemo(() => buildPolyline(steps), [steps])

  // Build all routes for fitBounds (include additional routes)
  const allSteps = useMemo(() => {
    const all = [...steps]
    if (additionalRoutes) {
      for (const route of additionalRoutes) all.push(...route)
    }
    return all
  }, [steps, additionalRoutes])

  // Additional routes data
  const extraRoutes = useMemo(() => {
    if (!additionalRoutes) return []
    return additionalRoutes.map((routeSteps, i) => ({
      polyline: buildPolyline(routeSteps),
      waypoints: collectWaypoints(routeSteps),
      colors: ROUTE_COLORS[(i + 1) % ROUTE_COLORS.length],
    }))
  }, [additionalRoutes])

  // Default center (France)
  const defaultCenter: L.LatLngExpression = [46.5, 2.0]

  return (
    <div className="relative h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <MapContainer
        center={defaultCenter}
        zoom={5}
        zoomControl={false}
        className="h-full w-full"
        attributionControl={false}
      >
        <FitBoundsToRoute steps={allSteps} />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />

        {/* Main route polyline */}
        {polylineCoords.length >= 2 && (
          <Polyline
            positions={polylineCoords}
            pathOptions={{
              color: ROUTE_COLORS[0].line,
              weight: 3,
              opacity: 0.85,
              dashArray: '8 6',
            }}
          />
        )}

        {/* Main route waypoint markers */}
        {waypoints.map((wp, i) => (
          <CircleMarker
            key={`wp-${i}`}
            center={[wp.lat, wp.lon]}
            radius={wp.isFirst || wp.isLast ? 7 : 4}
            pathOptions={{
              color: wp.isFirst ? '#22C55E' : wp.isLast ? '#EF4444' : ROUTE_COLORS[0].marker,
              fillColor: wp.isFirst ? '#BBF7D0' : wp.isLast ? '#FECACA' : ROUTE_COLORS[0].fill,
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
              <span className="text-xs font-medium">{wp.name}</span>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Additional route polylines + markers */}
        {extraRoutes.map((route, ri) => (
          <span key={`route-${ri}`}>
            {route.polyline.length >= 2 && (
              <Polyline
                positions={route.polyline}
                pathOptions={{
                  color: route.colors.line,
                  weight: 2.5,
                  opacity: 0.7,
                  dashArray: '6 8',
                }}
              />
            )}
            {route.waypoints.map((wp, wi) => (
              <CircleMarker
                key={`r${ri}-wp-${wi}`}
                center={[wp.lat, wp.lon]}
                radius={3}
                pathOptions={{
                  color: route.colors.marker,
                  fillColor: route.colors.fill,
                  fillOpacity: 0.9,
                  weight: 1.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.9}>
                  <span className="text-xs font-medium">{wp.name}</span>
                </Tooltip>
              </CircleMarker>
            ))}
          </span>
        ))}
      </MapContainer>
      {overlay && (
        <div className="absolute inset-0 z-[1000]">
          {overlay}
        </div>
      )}
    </div>
  )
}
