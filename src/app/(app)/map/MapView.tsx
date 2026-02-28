'use client'

import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, Polygon, useMap, useMapEvents } from 'react-leaflet'
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

// ── Refuge port icon ─────────────────────────────────────────────────────────

const refugePortIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 20px; height: 20px;
    background: #F97316;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// ── Danger zones ─────────────────────────────────────────────────────────────

interface DangerZone {
  name: string
  description: string
  severity: 'high' | 'medium'
  positions: [number, number][]
}

const DANGER_ZONES: DangerZone[] = [
  {
    name: 'Raz de Sein',
    description: 'Courants très violents (jusqu\'à 7 nœuds). Passage à étaler, fenêtre de 2h autour de la basse mer.',
    severity: 'high',
    positions: [
      [48.07, -4.85],
      [48.04, -4.80],
      [48.00, -4.82],
      [48.00, -4.88],
      [48.04, -4.90],
    ],
  },
  {
    name: 'Estuaire de la Gironde',
    description: 'Forts courants de marée, bancs de sable mouvants, navigation de nuit déconseillée.',
    severity: 'high',
    positions: [
      [45.65, -1.30],
      [45.65, -1.05],
      [45.52, -1.00],
      [45.40, -1.08],
      [45.40, -1.25],
      [45.52, -1.30],
    ],
  },
  {
    name: 'Golfe du Lion',
    description: 'Zone exposée au mistral et à la tramontane. Mer croisée fréquente, coups de vent soudains.',
    severity: 'medium',
    positions: [
      [43.45, 3.20],
      [43.45, 4.80],
      [42.80, 4.80],
      [42.80, 3.20],
    ],
  },
]

// ── Refuge ports ─────────────────────────────────────────────────────────────

interface RefugePort {
  name: string
  lat: number
  lon: number
  vhf: string
}

const REFUGE_PORTS: RefugePort[] = [
  { name: 'Camaret-sur-Mer', lat: 48.2778, lon: -4.5944, vhf: 'VHF 09' },
  { name: 'Douarnenez', lat: 48.1000, lon: -4.3333, vhf: 'VHF 09' },
  { name: 'Bénodet', lat: 47.8753, lon: -4.1103, vhf: 'VHF 09' },
  { name: 'Lorient', lat: 47.7333, lon: -3.3500, vhf: 'VHF 09' },
  { name: 'Belle-Île (Le Palais)', lat: 47.3486, lon: -3.1536, vhf: 'VHF 09' },
  { name: 'La Rochelle', lat: 46.1586, lon: -1.1536, vhf: 'VHF 09' },
  { name: 'Royan', lat: 45.6228, lon: -1.0286, vhf: 'VHF 12' },
  { name: 'Sète', lat: 43.3992, lon: 3.6992, vhf: 'VHF 09' },
  { name: 'Port-Camargue', lat: 43.5225, lon: 4.1344, vhf: 'VHF 09' },
  { name: 'Marseille (Vieux-Port)', lat: 43.2950, lon: 5.3625, vhf: 'VHF 12' },
  { name: 'Toulon', lat: 43.1167, lon: 5.9333, vhf: 'VHF 12' },
  { name: 'Saint-Raphaël', lat: 43.4250, lon: 6.7694, vhf: 'VHF 09' },
]

// ── Port info for enriched popups ────────────────────────────────────────────

interface PortInfo {
  vhf?: string
  facilities?: string[]
}

const PORT_INFO: Record<string, PortInfo> = {
  'Audierne': { vhf: 'VHF 09', facilities: ['Carburant', 'Eau', 'Électricité'] },
  'Camaret-sur-Mer': { vhf: 'VHF 09', facilities: ['Carburant', 'Eau', 'Shipchandler'] },
  'Douarnenez': { vhf: 'VHF 09', facilities: ['Carburant', 'Eau', 'Grue'] },
  'Lorient': { vhf: 'VHF 09', facilities: ['Carburant', 'Eau', 'Électricité', 'Shipchandler'] },
  'La Rochelle': { vhf: 'VHF 09', facilities: ['Carburant', 'Eau', 'Électricité', 'Shipchandler', 'Grue'] },
  'Royan': { vhf: 'VHF 12', facilities: ['Carburant', 'Eau', 'Électricité'] },
  'Sète': { vhf: 'VHF 09', facilities: ['Carburant', 'Eau', 'Électricité', 'Grue'] },
  'Marseille': { vhf: 'VHF 12', facilities: ['Carburant', 'Eau', 'Électricité', 'Shipchandler'] },
  'Toulon': { vhf: 'VHF 12', facilities: ['Carburant', 'Eau', 'Électricité', 'Shipchandler'] },
  'Nice': { vhf: 'VHF 09', facilities: ['Carburant', 'Eau', 'Électricité', 'Shipchandler'] },
}

// ── Map controller: passes L.Map instance up via callback ────────────────────

function MapController({ onMapInstance }: { onMapInstance: (map: L.Map) => void }) {
  const map = useMap()
  useEffect(() => {
    onMapInstance(map)
  }, [map, onMapInstance])
  return null
}

// ── Zoom tracker for conditional rendering ───────────────────────────────────

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend: (e) => {
      onZoomChange(e.target.getZoom())
    },
  })
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

// ── Port info lookup ─────────────────────────────────────────────────────────

function findPortInfo(name: string): PortInfo | null {
  for (const [portName, info] of Object.entries(PORT_INFO)) {
    if (name.includes(portName) || portName.includes(name)) {
      return info
    }
  }
  return null
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
  const [currentZoom, setCurrentZoom] = useState(zoom)

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
      <ZoomTracker onZoomChange={setCurrentZoom} />

      {/* ESRI Ocean Basemap — nautical chart style with bathymetry */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
        attribution='&copy; <a href="https://www.esri.com">Esri</a>, GEBCO, NOAA'
        maxZoom={13}
      />
      {/* ESRI Ocean Reference — labels and place names on top of base */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={13}
      />

      {/* OpenSeaMap overlay — navigation marks, buoys, lights */}
      <TileLayer
        url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
        opacity={0.85}
      />

      {/* Danger zones */}
      {DANGER_ZONES.map((zone) => (
        <Polygon
          key={zone.name}
          positions={zone.positions}
          pathOptions={{
            color: zone.severity === 'high' ? '#EF4444' : '#F97316',
            fillColor: zone.severity === 'high' ? '#EF4444' : '#F97316',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '6 4',
          }}
        >
          <Popup>
            <div className="max-w-[200px]">
              <p className="text-sm font-bold">{zone.name}</p>
              <p className="mt-1 text-xs text-gray-600">{zone.description}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                zone.severity === 'high'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {zone.severity === 'high' ? 'Danger élevé' : 'Attention'}
              </span>
            </div>
          </Popup>
        </Polygon>
      ))}

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

      {/* Waypoint markers with enriched popups */}
      {waypoints.map((wp, i) => {
        const portInfo = findPortInfo(wp.name)
        return (
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
              <div className="max-w-[180px]">
                <span className="text-sm font-medium">{wp.name}</span>
                {portInfo && (
                  <div className="mt-1">
                    {portInfo.vhf && (
                      <p className="text-xs text-gray-500">{portInfo.vhf}</p>
                    )}
                    {portInfo.facilities && portInfo.facilities.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {portInfo.facilities.map((f) => (
                          <span
                            key={f}
                            className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {/* Refuge ports — visible at zoom >= 8 */}
      {currentZoom >= 8 &&
        REFUGE_PORTS.map((port) => (
          <Marker key={port.name} position={[port.lat, port.lon]} icon={refugePortIcon}>
            <Popup>
              <div className="max-w-[160px]">
                <p className="text-sm font-medium">{port.name}</p>
                <p className="text-xs text-orange-600">Port de repli</p>
                <p className="text-xs text-gray-500">{port.vhf}</p>
              </div>
            </Popup>
          </Marker>
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
