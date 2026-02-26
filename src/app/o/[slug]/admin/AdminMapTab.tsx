"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { Boundary, Pin, PinCategory, PinStatus } from "@/types";
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_LABELS } from "@/types";

interface Props {
  pins: Pin[];
  boundaries: Boundary[];
  org: { id: string; name: string; slug: string };
  userId: string;
}

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

export default function AdminMapTab({ pins: initialPins, boundaries, org, userId }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  const [pins, setPins] = useState(initialPins);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Admin panel state
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const boundary = boundaries[0];
  const boundaryGeoJSON = boundary?.geog_json ? JSON.parse(boundary.geog_json) : null;
  const usedCategories = [...new Set(pins.map((p) => p.category))];

  // ── Init map (identical to CampaignMapClient) ──
  useEffect(() => {
    if (!mapContainer.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current) return;

      const map = L.map(mapContainer.current!, {
        center: [boundary?.center_lat ?? 39.5, boundary?.center_lng ?? -98.35],
        zoom: boundary?.default_zoom ?? 10,
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

  // ── Update markers (same style as CampaignMapClient, hidden pins faded) ──
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
        const opacity = pin.is_hidden ? 0.35 : 1;

        const icon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:32px;height:32px;opacity:${opacity}">
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
          setShowNoteInput(false);
          setNoteText("");
          setNoteSaved(false);
          map.flyTo([pin.lat, pin.lng], 15);
        });
        markersRef.current.push(marker);
      });
    }

    updateMarkers();
    return () => { cancelled = true; };
  }, [pins, mapReady]);

  // ── Admin actions ──
  async function updateStatus(status: PinStatus) {
    if (!selectedPin) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("pins").update({ status }).eq("id", selectedPin.id);
    if (!error) {
      const updated = { ...selectedPin, status };
      setPins((prev) => prev.map((p) => p.id === selectedPin.id ? updated : p));
      setSelectedPin(updated);
      await supabase.from("admin_actions").insert({
        org_id: org.id, actor_id: userId,
        action_type: "set_status", target_table: "pins",
        target_id: selectedPin.id, details: { status },
      });
    }
    setActionLoading(false);
  }

  async function toggleHidden() {
    if (!selectedPin) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("pins").update({ is_hidden: !selectedPin.is_hidden }).eq("id", selectedPin.id);
    if (!error) {
      const updated = { ...selectedPin, is_hidden: !selectedPin.is_hidden };
      setPins((prev) => prev.map((p) => p.id === selectedPin.id ? updated : p));
      setSelectedPin(updated);
      await supabase.from("admin_actions").insert({
        org_id: org.id, actor_id: userId,
        action_type: selectedPin.is_hidden ? "unhide_pin" : "hide_pin",
        target_table: "pins", target_id: selectedPin.id, details: {},
      });
    }
    setActionLoading(false);
  }

  async function addNote() {
    if (!selectedPin || !noteText.trim()) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("admin_actions").insert({
      org_id: org.id, actor_id: userId,
      action_type: "note", target_table: "pins",
      target_id: selectedPin.id, details: { note: noteText.trim() },
    });
    if (!error) {
      setNoteText("");
      setShowNoteInput(false);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
    }
    setActionLoading(false);
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Map ── */}
      <div className="relative flex-1">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Legend — identical to user view */}
        {usedCategories.length > 0 && (
          <div className="absolute bottom-20 left-4 bg-white border-2 border-[#1E1E1E] rounded-[12px] px-4 py-3 z-[1000]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {usedCategories.map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                  <span className="text-xs font-bold text-[#1E1E1E]">
                    {CATEGORY_SHORT[cat] ?? cat.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin badge */}
        <div className="absolute top-4 left-4 z-[1000] bg-[#1E1E1E] text-white text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider">
          ADMIN VIEW — {pins.filter(p => p.is_hidden).length} hidden pins visible
        </div>

        {/* ── Pin popup — user view + admin controls ── */}
        {selectedPin && (
          <div className="absolute bottom-0 left-0 right-0 z-[1001] bg-white border-t-2 border-[#1E1E1E] shadow-lg">
            <div className="max-w-3xl mx-auto p-5">
              {/* Row 1: user-facing info (identical to CampaignMapClient) */}
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: CATEGORY_COLORS[selectedPin.category] }}
                    >
                      {CATEGORY_SHORT[selectedPin.category]}
                    </span>
                    {selectedPin.is_hidden && (
                      <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded">HIDDEN</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold mb-1">{selectedPin.title}</h3>
                  <p className="text-sm text-[#6B6B6B] line-clamp-2">{selectedPin.description}</p>
                  {selectedPin.profile?.email && (
                    <p className="text-xs text-[#9B9B9B] mt-1">by {selectedPin.profile.email} · {timeAgo(selectedPin.created_at)}</p>
                  )}
                </div>

                {selectedPin.photo_url && (
                  <img
                    src={selectedPin.photo_url}
                    alt={selectedPin.title}
                    className="w-20 h-20 rounded-[10px] border-2 border-[#1E1E1E] object-cover flex-shrink-0"
                  />
                )}

                {/* User-facing buttons */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link
                    href={`/o/${org.slug}/c/${selectedPin.campaign_id}/pin/${selectedPin.id}`}
                    target="_blank"
                    className="px-4 py-2 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[12px] font-bold text-sm text-[#1E1E1E] hover:bg-[#0891B2] transition-all whitespace-nowrap text-center"
                  >
                    VIEW DETAILS
                  </Link>
                  <button
                    onClick={() => { setSelectedPin(null); setShowNoteInput(false); setNoteText(""); }}
                    className="px-4 py-2 border-2 border-[#1E1E1E] rounded-[12px] font-bold text-sm text-[#1E1E1E] hover:bg-[#F6F0EA] transition-all"
                  >
                    CLOSE
                  </button>
                </div>
              </div>

              {/* Row 2: Admin controls (divider) */}
              <div className="border-t-2 border-dashed border-[#E5E5E5] pt-3 flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B]">Admin:</span>

                {/* Status */}
                <select
                  value={selectedPin.status}
                  onChange={(e) => updateStatus(e.target.value as PinStatus)}
                  disabled={actionLoading}
                  className="text-xs border-2 border-[#1E1E1E] rounded-[10px] px-2 py-1.5 bg-white outline-none font-bold"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                {/* Note */}
                {showNoteInput ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Internal note..."
                      className="flex-1 text-xs border-2 border-[#1E1E1E] rounded-[10px] px-3 py-1.5 outline-none"
                      onKeyDown={(e) => e.key === "Enter" && addNote()}
                      autoFocus
                    />
                    <button
                      onClick={addNote}
                      disabled={!noteText.trim() || actionLoading}
                      className="px-3 py-1.5 bg-[#1E1E1E] text-white rounded-[10px] text-xs font-bold disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setShowNoteInput(false); setNoteText(""); }}
                      className="px-3 py-1.5 border-2 border-[#1E1E1E] rounded-[10px] text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNoteInput(true)}
                    className="px-3 py-1.5 border-2 border-[#1E1E1E] rounded-[10px] text-xs font-bold hover:bg-[#F6F0EA] transition-all"
                  >
                    + Note
                  </button>
                )}

                {/* Hide/Unhide */}
                <button
                  onClick={toggleHidden}
                  disabled={actionLoading}
                  className={`px-3 py-1.5 border-2 rounded-[10px] text-xs font-bold transition-all disabled:opacity-40 ml-auto ${
                    selectedPin.is_hidden
                      ? "border-green-500 text-green-600 hover:bg-green-50"
                      : "border-red-400 text-red-500 hover:bg-red-50"
                  }`}
                >
                  {selectedPin.is_hidden ? "Unhide Pin" : "Hide Pin"}
                </button>

                {/* Note saved confirmation */}
                {noteSaved && <span className="text-green-600 text-xs font-bold">✓ Note saved</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sidebar — identical to CampaignMapClient ── */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[#1E1E1E]">
        <div className="px-5 py-4 border-b border-[#333]">
          <h2 className="text-white font-bold text-base tracking-wider">RECENT ACTIVITY</h2>
          <p className="text-[#6B6B6B] text-xs mt-0.5">Real-time mobility reports</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
          {pins.length === 0 ? (
            <p className="text-[#6B6B6B] text-sm text-center py-8">No reports yet</p>
          ) : (
            pins.slice(0, 20).map((pin) => (
              <button
                key={pin.id}
                onClick={() => {
                  setSelectedPin(pin);
                  setShowNoteInput(false);
                  setNoteText("");
                  setNoteSaved(false);
                  mapRef.current?.flyTo([pin.lat, pin.lng], 15);
                }}
                className={`w-full text-left border-2 border-[#1E1E1E] rounded-[12px] p-3 transition-colors ${
                  pin.is_hidden ? "bg-[#2A2A2A] opacity-60" : "bg-white hover:bg-[#F6F0EA]"
                }`}
              >
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-[8px] bg-[#E5E5E5] flex-shrink-0 overflow-hidden border border-[#DDD]">
                    {pin.photo_url ? (
                      <img src={pin.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full opacity-40" style={{ backgroundColor: CATEGORY_COLORS[pin.category] }} />
                    )}
                  </div>
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
                    <p className={`font-bold text-sm truncate ${pin.is_hidden ? "text-[#9B9B9B]" : "text-[#1E1E1E]"}`}>
                      {pin.title}
                    </p>
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

        <div className="px-5 py-4 border-t border-[#333] flex items-center justify-between">
          <span className="text-[#6B6B6B] text-xs font-bold tracking-wider uppercase">Total Reports</span>
          <span className="text-white font-bold text-lg">{pins.length.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
