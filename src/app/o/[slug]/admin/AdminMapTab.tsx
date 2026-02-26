"use client";

import { useState, useRef, useEffect } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { Boundary, Pin, PinStatus } from "@/types";
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
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminMapTab({ pins: initialPins, boundaries, org, userId }: Props) {
  const [pins, setPins] = useState(initialPins);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const boundary = boundaries[0];

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current) return;

      const map = L.map(mapContainerRef.current!, {
        center: [boundary?.center_lat ?? 39.5, boundary?.center_lng ?? -98.35],
        zoom: boundary?.default_zoom ?? 10,
        zoomControl: false,
      });

      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      if (boundary?.geog_json) {
        try {
          const geojson = JSON.parse(boundary.geog_json);
          const boundsLayer = L.geoJSON(geojson);
          L.geoJSON(geojson, {
            style: { color: "#444444", weight: 2, dashArray: "6 4", fill: false },
          }).addTo(map);
          map.fitBounds(boundsLayer.getBounds(), { padding: [40, 40], maxZoom: 15 });
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

  // Update markers whenever pins or mapReady changes
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
        const color = pin.is_hidden ? "#9B9B9B" : (CATEGORY_COLORS[pin.category] ?? "#6B6B6B");
        const icon = L.divIcon({
          className: "",
          html: `<div style="position:relative;width:32px;height:32px">
            <div style="
              width:26px;height:26px;
              background:${color};border:2px solid #1E1E1E;
              border-radius:50% 50% 50% 0;transform:rotate(-45deg);
              cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.25);
              opacity:${pin.is_hidden ? 0.5 : 1};
            "></div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [2, 28],
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

  async function updateStatus(pin: Pin, status: PinStatus) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("pins").update({ status }).eq("id", pin.id);
    if (!error) {
      setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, status } : p));
      setSelectedPin((prev) => prev?.id === pin.id ? { ...prev, status } : prev);
      await supabase.from("admin_actions").insert({
        org_id: org.id, actor_id: userId,
        action_type: "set_status", target_table: "pins",
        target_id: pin.id, details: { status },
      });
    }
    setActionLoading(false);
  }

  async function toggleHidden(pin: Pin) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("pins").update({ is_hidden: !pin.is_hidden }).eq("id", pin.id);
    if (!error) {
      const updated = { ...pin, is_hidden: !pin.is_hidden };
      setPins((prev) => prev.map((p) => p.id === pin.id ? updated : p));
      setSelectedPin(updated);
      await supabase.from("admin_actions").insert({
        org_id: org.id, actor_id: userId,
        action_type: pin.is_hidden ? "unhide_pin" : "hide_pin",
        target_table: "pins", target_id: pin.id, details: {},
      });
    }
    setActionLoading(false);
  }

  async function addNote(pin: Pin) {
    if (!noteText.trim()) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("admin_actions").insert({
      org_id: org.id, actor_id: userId,
      action_type: "note", target_table: "pins",
      target_id: pin.id, details: { note: noteText.trim() },
    });
    if (!error) {
      setNoteText("");
      setShowNoteInput(false);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }
    setActionLoading(false);
  }

  const visibleCount = pins.filter((p) => !p.is_hidden).length;
  const hiddenCount = pins.filter((p) => p.is_hidden).length;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Stats overlay */}
        <div className="absolute top-4 left-4 z-[1000] bg-white border-2 border-[#1E1E1E] rounded-[12px] px-4 py-2 flex items-center gap-4 text-xs font-bold shadow">
          <span className="text-[#1E1E1E]">{visibleCount} visible</span>
          {hiddenCount > 0 && <span className="text-[#9B9B9B]">{hiddenCount} hidden</span>}
        </div>
      </div>

      {/* Detail panel */}
      {selectedPin ? (
        <div className="w-80 flex-shrink-0 bg-white border-l-2 border-[#1E1E1E] flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-4 border-b-2 border-[#1E1E1E] flex items-center justify-between flex-shrink-0">
            <span
              className="text-xs font-bold px-2 py-1 rounded text-white"
              style={{ backgroundColor: CATEGORY_COLORS[selectedPin.category] }}
            >
              {CATEGORY_LABELS[selectedPin.category]?.toUpperCase()}
            </span>
            {selectedPin.is_hidden && (
              <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded">HIDDEN</span>
            )}
            <button
              onClick={() => setSelectedPin(null)}
              className="text-[#6B6B6B] hover:text-[#1E1E1E] text-2xl leading-none ml-auto"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Photo */}
            {selectedPin.photo_url && (
              <img
                src={selectedPin.photo_url}
                alt={selectedPin.title}
                className="w-full h-40 object-cover border-b-2 border-[#1E1E1E]"
              />
            )}

            <div className="px-5 py-4 space-y-4">
              {/* Title + desc */}
              <div>
                <h3 className="font-bold text-[#1E1E1E] text-base">{selectedPin.title}</h3>
                <p className="text-sm text-[#6B6B6B] mt-1 leading-relaxed">{selectedPin.description}</p>
              </div>

              {/* Reporter */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-1">Reporter</p>
                <p className="text-sm text-[#1E1E1E]">{selectedPin.profile?.email ?? "Unknown"}</p>
                <p className="text-xs text-[#9B9B9B]">{timeAgo(selectedPin.created_at)}</p>
              </div>

              {/* Location */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-1">Location</p>
                <p className="text-sm text-[#1E1E1E] font-mono">
                  {selectedPin.lat.toFixed(5)}, {selectedPin.lng.toFixed(5)}
                </p>
              </div>

              {/* Status */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-2">Status</p>
                <select
                  value={selectedPin.status}
                  onChange={(e) => updateStatus(selectedPin, e.target.value as PinStatus)}
                  disabled={actionLoading}
                  className="w-full text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-2 bg-white outline-none"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Note success */}
              {noteSaved && (
                <p className="text-green-600 text-xs font-bold">✓ Note saved</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t-2 border-[#1E1E1E] space-y-2 flex-shrink-0">
            {showNoteInput ? (
              <div className="space-y-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write an internal note..."
                  className="w-full text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-2 outline-none resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => addNote(selectedPin)}
                    disabled={!noteText.trim() || actionLoading}
                    className="flex-1 px-3 py-2 bg-[#1E1E1E] text-white rounded-[10px] text-sm font-bold disabled:opacity-50"
                  >
                    Save Note
                  </button>
                  <button
                    onClick={() => { setShowNoteInput(false); setNoteText(""); }}
                    className="px-3 py-2 border-2 border-[#1E1E1E] rounded-[10px] text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNoteInput(true)}
                className="w-full px-4 py-2.5 bg-[#1E1E1E] text-white rounded-[12px] text-sm font-bold hover:bg-[#333] transition-all"
              >
                + Add Internal Note
              </button>
            )}
            <button
              onClick={() => toggleHidden(selectedPin)}
              disabled={actionLoading}
              className={`w-full px-4 py-2.5 border-2 rounded-[12px] text-sm font-bold transition-all disabled:opacity-50 ${
                selectedPin.is_hidden
                  ? "border-green-500 text-green-600 hover:bg-green-50"
                  : "border-red-400 text-red-500 hover:bg-red-50"
              }`}
            >
              {selectedPin.is_hidden ? "Unhide Pin" : "Hide Pin"}
            </button>
          </div>
        </div>
      ) : (
        /* Empty state hint */
        <div className="w-72 flex-shrink-0 bg-white border-l-2 border-[#1E1E1E] flex flex-col items-center justify-center text-center p-8 gap-3">
          <div className="w-12 h-12 bg-[#F6F0EA] rounded-full flex items-center justify-center text-2xl">📍</div>
          <p className="text-sm font-bold text-[#1E1E1E]">Click any pin</p>
          <p className="text-xs text-[#9B9B9B]">Select a pin on the map to view details, change status, or add a note.</p>
        </div>
      )}
    </div>
  );
}
