'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Database } from '@/lib/supabase/types'
import { useTheme } from '@/lib/theme'

type RouteStepRow = Database['public']['Tables']['route_steps']['Row']

// ── Fix Leaflet default icon issue in Next.js ────────────────────────────────

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Phase colors ─────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  atlantic: '#3B82F6',
  gironde: '#F59E0B',
  garonne_canal: '#22C55E',
  midi_canal: '#A855F7',
  mediterranean: '#06B6D4',
}

const DEFAULT_SEGMENT_COLOR = '#3B82F6'

// ── Nav status colors ────────────────────────────────────────────────────────

const NAV_STATUS_COLORS: Record<string, string> = {
  sailing: '#22C55E',
  in_port: '#3B82F6',
  at_anchor: '#F59E0B',
  in_canal: '#A855F7',
}

const NAV_STATUS_LABELS: Record<string, string> = {
  sailing: 'En navigation',
  in_port: 'Au port',
  at_anchor: 'Au mouillage',
  in_canal: 'En canal',
}

// ── Boat icon by nav_status ──────────────────────────────────────────────────

function createBoatIcon(navStatus: string | null): L.DivIcon {
  const color = (navStatus && NAV_STATUS_COLORS[navStatus]) || '#3B82F6'
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:40px;height:40px;">
      <div style="
        position:absolute;inset:0;
        background:${color};
        border-radius:50%;
        opacity:0.3;
        animation:pulse-ring 1.5s infinite;
      "></div>
      <div style="
        position:absolute;inset:4px;
        background:${color};
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 20l.8-2.4A2 2 0 0 1 4.7 16h14.6a2 2 0 0 1 1.9 1.6L22 20"/>
          <path d="M12 16V4"/>
          <path d="M12 4l6 12"/>
          <path d="M12 4L6 16"/>
        </svg>
      </div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

// ── GPS user icon ────────────────────────────────────────────────────────────

const userGpsIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:24px;height:24px;">
    <div style="
      position:absolute;inset:0;
      background:#3B82F6;
      border-radius:50%;
      opacity:0.25;
      animation:pulse-ring 2s infinite;
    "></div>
    <div style="
      position:absolute;inset:4px;
      background:#3B82F6;
      border:2px solid white;
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.3);
    "></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// ── Map controller: passes L.Map instance up via callback ────────────────────

function MapController({ onMapInstance }: { onMapInstance: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onMapInstance(map)
  }, [map, onMapInstance])
  return null
}

// ── AutoCenter: fly to boat on first render ──────────────────────────────────

function AutoCenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  const hasCentered = useRef(false)

  useEffect(() => {
    if (hasCentered.current) return
    hasCentered.current = true
    const timer = setTimeout(() => {
      map.flyTo([lat, lon], 10, { duration: 1.2 })
    }, 300)
    return () => clearTimeout(timer)
  }, [map, lat, lon])

  return null
}

// ── Helper: build polyline segments by status ────────────────────────────────

interface RouteSegment {
  positions: L.LatLngExpression[]
  status: 'done' | 'in_progress' | 'to_do'
  fromPort: string
  toPort: string
  distanceNm: number | null
  distanceKm: number | null
  phase: string | null
  notes: string | null
  name: string
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
      fromPort: step.from_port,
      toPort: step.to_port,
      distanceNm: step.distance_nm,
      distanceKm: step.distance_km,
      phase: step.phase,
      notes: step.notes,
      name: step.name,
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

function getPhaseColor(phase: string | null): string {
  if (!phase) return DEFAULT_SEGMENT_COLOR
  const key = phase.toLowerCase().replace(/[\s-]/g, '_')
  return PHASE_COLORS[key] ?? DEFAULT_SEGMENT_COLOR
}

function blendToGray(hex: string, amount: number): string {
  const gray = { r: 156, g: 163, b: 175 } // #9CA3AF
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const nr = Math.round(r + (gray.r - r) * amount)
  const ng = Math.round(g + (gray.g - g) * amount)
  const nb = Math.round(b + (gray.b - b) * amount)
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

function getSegmentColor(seg: RouteSegment): string {
  const phaseColor = getPhaseColor(seg.phase)
  if (seg.status === 'done') return blendToGray(phaseColor, 0.6)
  return phaseColor
}

function getSegmentWeight(status: RouteSegment['status']): number {
  switch (status) {
    case 'in_progress': return 6
    case 'done': return 3
    case 'to_do': return 3
  }
}

function getSegmentDash(status: RouteSegment['status']): string | undefined {
  return status === 'to_do' ? '8 6' : undefined
}

function getSegmentOpacity(status: RouteSegment['status']): number {
  switch (status) {
    case 'done': return 0.5
    case 'in_progress': return 0.9
    case 'to_do': return 0.85
  }
}

// ── Status labels ────────────────────────────────────────────────────────────

const SEGMENT_STATUS_LABELS: Record<string, string> = {
  done: 'Terminé',
  in_progress: 'En cours',
  to_do: 'À faire',
}

const PHASE_LABELS: Record<string, string> = {
  atlantic: 'Atlantique',
  gironde: 'Gironde',
  garonne_canal: 'Canal de Garonne',
  midi_canal: 'Canal du Midi',
  mediterranean: 'Méditerranée',
}

function getPhaseLabelFr(phase: string | null): string {
  if (!phase) return 'Inconnue'
  const key = phase.toLowerCase().replace(/[\s-]/g, '_')
  return PHASE_LABELS[key] ?? phase
}

// ── Exported handle type ─────────────────────────────────────────────────────

export interface MapViewHandle {
  flyTo: (lat: number, lng: number, zoom: number) => void
}

// ── Exported phase data for legend ───────────────────────────────────────────

export const PHASES = [
  { key: 'atlantic', label: 'Atlantique', color: '#3B82F6' },
  { key: 'gironde', label: 'Gironde', color: '#F59E0B' },
  { key: 'garonne_canal', label: 'Canal de Garonne', color: '#22C55E' },
  { key: 'midi_canal', label: 'Canal du Midi', color: '#A855F7' },
  { key: 'mediterranean', label: 'Méditerranée', color: '#06B6D4' },
] as const

// ── MapView component ────────────────────────────────────────────────────────

interface MapViewProps {
  center: { lat: number; lng: number }
  zoom: number
  routeSteps: RouteStepRow[]
  boatLat: number | null
  boatLon: number | null
  boatName: string | null
  navStatus: string | null
  gpsLat: number | null
  gpsLon: number | null
  onMapReady?: (handle: MapViewHandle) => void
}

export default function MapView({
  center,
  zoom,
  routeSteps,
  boatLat,
  boatLon,
  boatName,
  navStatus,
  gpsLat,
  gpsLon,
  onMapReady,
}: MapViewProps) {
  const { resolved: themeMode } = useTheme()
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

  const boatIcon = useMemo(() => createBoatIcon(navStatus), [navStatus])
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

      {/* Auto-center on boat position */}
      {boatLat != null && boatLon != null && (
        <AutoCenter lat={boatLat} lon={boatLon} />
      )}

      <TileLayer
        key={`base-${themeMode}`}
        url={themeMode === 'dark'
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        }
        attribution={themeMode === 'dark'
          ? '&copy; <a href="https://carto.com">CARTO</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
      />
      <TileLayer
        url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
        opacity={themeMode === 'dark' ? 0.9 : 0.8}
      />

      {/* Glow under in_progress segments */}
      {segments.filter(s => s.status === 'in_progress').map((seg, i) => (
        <Polyline
          key={`glow-${i}`}
          positions={seg.positions}
          pathOptions={{
            color: getPhaseColor(seg.phase),
            weight: 14,
            opacity: 0.2,
            lineCap: 'round',
          }}
        />
      ))}

      {/* Route polylines by status with popups */}
      {segments.map((seg, i) => (
        <Polyline
          key={`seg-${i}`}
          positions={seg.positions}
          pathOptions={{
            color: getSegmentColor(seg),
            weight: getSegmentWeight(seg.status),
            opacity: getSegmentOpacity(seg.status),
            dashArray: getSegmentDash(seg.status),
          }}
        >
          <Popup>
            <div className="min-w-[180px] text-sm">
              <p className="font-semibold text-base mb-1">{seg.fromPort} → {seg.toPort}</p>

              {/* Phase */}
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: getPhaseColor(seg.phase) }}
                />
                <span className="text-xs opacity-80">{getPhaseLabelFr(seg.phase)}</span>
              </div>

              {/* Distance */}
              {(seg.distanceNm != null || seg.distanceKm != null) && (
                <p className="text-xs opacity-70 mb-1">
                  {seg.distanceNm != null && <span>{seg.distanceNm} NM</span>}
                  {seg.distanceNm != null && seg.distanceKm != null && <span> · </span>}
                  {seg.distanceKm != null && <span>{seg.distanceKm} km</span>}
                </p>
              )}

              {/* Status */}
              <p className="text-xs">
                <span className={
                  seg.status === 'done' ? 'text-green-500' :
                  seg.status === 'in_progress' ? 'text-blue-500' :
                  'opacity-60'
                }>
                  {SEGMENT_STATUS_LABELS[seg.status]}
                </span>
              </p>

              {/* Notes */}
              {seg.notes && (
                <>
                  <hr className="my-1.5 border-current opacity-15" />
                  <p className="text-xs italic opacity-70">{seg.notes}</p>
                </>
              )}
            </div>
          </Popup>
        </Polyline>
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

      {/* GPS user position marker */}
      {gpsLat != null && gpsLon != null && (
        <Marker position={[gpsLat, gpsLon]} icon={userGpsIcon} zIndexOffset={-100}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">Ma position GPS</p>
              <p className="text-xs opacity-60">
                {gpsLat.toFixed(4)}, {gpsLon.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Boat position marker */}
      {boatLat != null && boatLon != null && (
        <Marker position={[boatLat, boatLon]} icon={boatIcon} zIndexOffset={100}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold text-base">{boatName ?? 'Position actuelle'}</p>
              {navStatus && (
                <p className="text-xs mt-0.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ background: NAV_STATUS_COLORS[navStatus] ?? '#3B82F6' }}
                  />
                  {NAV_STATUS_LABELS[navStatus] ?? navStatus}
                </p>
              )}
              <p className="text-xs opacity-60 mt-0.5">
                {boatLat.toFixed(4)}, {boatLon.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
