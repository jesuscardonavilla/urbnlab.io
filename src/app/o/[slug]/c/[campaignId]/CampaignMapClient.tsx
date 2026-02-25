"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { Campaign, Pin, PinCategory } from "@/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/types";

interface Props {
  campaign: Campaign;
  pins: Pin[];
  org: { id: string; name: string; slug: string };
  membership: { role: string } | null;
  userId: string | null;
}

const TC = { lat: 44.7631, lng: -85.6206, zoom: 12 };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  return `${Math.floor(hrs / 24)}D AGO`;
}

const CATEGORY_SHORT: Record<PinCategory, string> = {
  crosswalk_needed: "CROSSWALK",
  sidewalk_ada: "SIDEWALK",
  bus_stop_needed: "BUS STOP",
  bike_lane_needed: "BIKE LANE",
  traffic_signal: "TRAFFIC",
  street_maintenance: "STREET",
  tourism_pressure: "TOURISM",
  climate_stress: "CLIMATE",
};

export default function CampaignMapClient({ campaign, pins, org, membership }: Props) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const boundary = campaign.boundary;
  const boundaryGeoJSON = boundary?.geog_json ? JSON.parse(boundary.geog_json) : null;

  const now = new Date();
  const campaignActive =
    new Date(campaign.start_at) <= now && now <= new Date(campaign.end_at);

  // Init map
  useEffect(() => {
    if (!mapContainer.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current) return;

      const map = L.map(mapContainer.current!, {
        center: [boundary?.center_lat ?? TC.lat, boundary?.center_lng ?? TC.lng],
        zoom: boundary?.default_zoom ?? TC.zoom,
        zoomControl: false,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      if (boundaryGeoJSON) {
        const boundsLayer = L.geoJSON(boundaryGeoJSON);
        const worldRing: [number, number][] = [
          [-180, -89.99], [180, -89.99], [180, 89.99], [-180, 89.99], [-180, -89.99],
        ];
        const boundaryRing: [number, number][] = boundaryGeoJSON.coordinates[0];

        L.geoJSON(
          {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [worldRing, boundaryRing] } as GeoJSON.Geometry,
            properties: {},
          } as GeoJSON.Feature,
          { style: { fillColor: "#888888", fillOpacity: 0.45, stroke: false, weight: 0 } }
        ).addTo(map);

        L.geoJSON(boundaryGeoJSON, {
          style: { color: "#444444", weight: 2.5, dashArray: "8 5", fill: false },
        }).addTo(map);

        try {
          map.fitBounds(boundsLayer.getBounds(), { padding: [40, 40], maxZoom: 16 });
        } catch {}
      }

      mapRef.current = map;
      if (!cancelled) setMapReady(true);
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  // Update markers
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;

    async function updateMarkers() {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (!map || cancelled) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      pins.forEach((pin) => {
        const color = CATEGORY_COLORS[pin.category] ?? "#6B6B6B";
        const votes = pin.vote_count ?? 0;

        const icon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:32px;height:32px">
            <div style="
              width:28px;height:28px;
              background:${color};border:2px solid #1E1E1E;
              border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.2);
            "></div>
            ${votes > 0 ? `<div style="
              position:absolute;top:-6px;right:-6px;
              background:white;border:2px solid #1E1E1E;border-radius:999px;
              font-size:10px;font-weight:bold;padding:0 3px;min-width:16px;
              text-align:center;color:#1E1E1E;line-height:16px;
            ">${votes}</div>` : ""}
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [2, 30],
        });

        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
        marker.on("click", () => {
          setSelectedPin(pin);
          map.flyTo([pin.lat, pin.lng], 15);
        });
        markersRef.current.push(marker);
      });
    }

    updateMarkers();
    return () => { cancelled = true; };
  }, [pins, mapReady]);

  // Unique categories present in pins for legend
  const usedCategories = [...new Set(pins.map((p) => p.category))];

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>

      {/* ── Custom Header ── */}
      <header className="flex-shrink-0 bg-white border-b-2 border-[#1E1E1E] px-6 h-16 flex items-center justify-between z-[1100]">
        {/* Left: Logo + campaign info */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#1E1E1E] rounded-[8px] flex items-center justify-center">
              <span className="text-white font-bold text-sm">U</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-[#1E1E1E]">URBANMAPS.IO</span>
          </Link>
          <div className="w-px h-8 bg-[#1E1E1E]" />
          <div>
            <p className="text-xs text-[#6B6B6B] font-medium uppercase tracking-wider">
              {campaignActive ? "Active Campaign" : "Campaign"}
            </p>
            <p className="font-bold text-[#1E1E1E] leading-tight">{campaign.title}</p>
          </div>
        </div>

        {/* Right: Nav links + avatar */}
        <div className="flex items-center gap-6">
          <Link
            href={`/o/${org.slug}`}
            className="text-sm font-bold text-[#1E1E1E] hover:text-[#06B6D4] transition-colors tracking-wider"
          >
            EXPLORE
          </Link>
          <button className="text-sm font-bold text-[#6B6B6B] hover:text-[#1E1E1E] transition-colors tracking-wider">
            STATS
          </button>
          <button className="text-sm font-bold text-[#6B6B6B] hover:text-[#1E1E1E] transition-colors tracking-wider">
            ABOUT
          </button>
          <div className="w-9 h-9 rounded-full bg-[#F6C8B8] border-2 border-[#1E1E1E]" />
        </div>
      </header>

      {/* ── Main: Map + Sidebar ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="relative flex-1">
          <div ref={mapContainer} className="absolute inset-0" />

          {/* Legend */}
          {usedCategories.length > 0 && (
            <div className="absolute bottom-20 left-4 bg-white border-2 border-[#1E1E1E] rounded-[12px] px-4 py-3 z-[1000]">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {usedCategories.map((cat) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    <span className="text-xs font-bold text-[#1E1E1E]">
                      {CATEGORY_SHORT[cat] ?? cat.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PIN A NEW ISSUE button */}
          {campaignActive && membership && (
            <Link
              href={`/o/${org.slug}/c/${campaign.id}/add`}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-6 py-3 bg-[#1E1E1E] text-white rounded-full font-bold text-sm hover:bg-[#333] transition-all shadow-lg"
            >
              <span className="text-lg">📍</span>
              PIN A NEW ISSUE
            </Link>
          )}

          {/* Pin detail popup */}
          {selectedPin && (
            <div className="absolute bottom-0 left-0 right-0 z-[1001] bg-white border-t-2 border-[#1E1E1E] shadow-lg">
              <div className="max-w-2xl mx-auto p-5 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: CATEGORY_COLORS[selectedPin.category] }}
                    >
                      {CATEGORY_SHORT[selectedPin.category]}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-1">{selectedPin.title}</h3>
                  <p className="text-sm text-[#6B6B6B] line-clamp-2">{selectedPin.description}</p>
                </div>
                {selectedPin.photo_url && (
                  <img
                    src={selectedPin.photo_url}
                    alt={selectedPin.title}
                    className="w-20 h-20 rounded-[10px] border-2 border-[#1E1E1E] object-cover"
                  />
                )}
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/o/${org.slug}/c/${campaign.id}/pin/${selectedPin.id}`}
                    className="px-4 py-2 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[12px] font-bold text-sm text-[#1E1E1E] hover:bg-[#0891B2] transition-all whitespace-nowrap"
                  >
                    VIEW DETAILS
                  </Link>
                  <button
                    onClick={() => setSelectedPin(null)}
                    className="px-4 py-2 border-2 border-[#1E1E1E] rounded-[12px] font-bold text-sm text-[#1E1E1E] hover:bg-[#F6F0EA] transition-all"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="w-80 flex-shrink-0 flex flex-col bg-[#1E1E1E]">
          {/* Sidebar header */}
          <div className="px-5 py-4 border-b border-[#333]">
            <h2 className="text-white font-bold text-base tracking-wider">RECENT ACTIVITY</h2>
            <p className="text-[#6B6B6B] text-xs mt-0.5">Real-time mobility reports</p>
          </div>

          {/* Pin cards */}
          <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
            {pins.length === 0 ? (
              <p className="text-[#6B6B6B] text-sm text-center py-8">No reports yet</p>
            ) : (
              pins.slice(0, 20).map((pin) => (
                <button
                  key={pin.id}
                  onClick={() => {
                    setSelectedPin(pin);
                    mapRef.current?.flyTo([pin.lat, pin.lng], 15);
                  }}
                  className="w-full text-left bg-white border-2 border-[#1E1E1E] rounded-[12px] p-3 hover:bg-[#F6F0EA] transition-colors"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-[8px] bg-[#E5E5E5] flex-shrink-0 overflow-hidden border border-[#DDD]">
                      {pin.photo_url ? (
                        <img src={pin.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full opacity-40"
                          style={{ backgroundColor: CATEGORY_COLORS[pin.category] }}
                        />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white leading-tight"
                          style={{ backgroundColor: CATEGORY_COLORS[pin.category] }}
                        >
                          {CATEGORY_SHORT[pin.category]}
                        </span>
                        <span className="text-[10px] text-[#6B6B6B] font-medium flex-shrink-0">
                          {timeAgo(pin.created_at)}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-[#1E1E1E] truncate">{pin.title}</p>
                      {pin.description && (
                        <p className="text-[11px] text-[#6B6B6B] italic line-clamp-2 mt-0.5">
                          &ldquo;{pin.description}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Total reports footer */}
          <div className="px-5 py-4 border-t border-[#333] flex items-center justify-between">
            <span className="text-[#6B6B6B] text-xs font-bold tracking-wider uppercase">Total Reports</span>
            <span className="text-white font-bold text-lg">{pins.length.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
