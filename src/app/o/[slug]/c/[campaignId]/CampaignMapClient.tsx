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

export default function CampaignMapClient({ campaign, pins, org, membership }: Props) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [filterCategory, setFilterCategory] = useState<PinCategory | "all">("all");
  const [mapReady, setMapReady] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  const boundary = campaign.boundary;
  const boundaryGeoJSON = boundary?.geog_json ? JSON.parse(boundary.geog_json) : null;

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

      L.control.zoom({ position: "topleft" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap',
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
          {
            style: { fillColor: "#888888", fillOpacity: 0.45, stroke: false, weight: 0 },
          }
        ).addTo(map);

        L.geoJSON(boundaryGeoJSON, {
          style: { color: "#444444", weight: 2.5, dashArray: "8 5", fill: false },
        }).addTo(map);

        try {
          const bounds = boundsLayer.getBounds();
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
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

      const filtered = pins.filter((p) => {
        if (filterCategory !== "all" && p.category !== filterCategory) return false;
        return true;
      });

      filtered.forEach((pin) => {
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
            ${
              votes > 0
                ? `<div style="
                position:absolute;top:-6px;right:-6px;
                background:white;border:2px solid #1E1E1E;border-radius:999px;
                font-size:10px;font-weight:bold;padding:0 3px;min-width:16px;
                text-align:center;color:#1E1E1E;line-height:16px;
              ">${votes}</div>`
                : ""
            }
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [2, 30],
        });

        const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
        marker.on("click", () => setSelectedPin(pin));
        markersRef.current.push(marker);
      });
    }

    updateMarkers();
    return () => { cancelled = true; };
  }, [pins, mapReady, filterCategory]);

  const filteredPins = pins.filter((p) => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    return true;
  }).slice(0, 4); // Show recent 4

  const now = new Date();
  const campaignActive =
    new Date(campaign.start_at) <= now && now <= new Date(campaign.end_at);

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-white border-b-2 border-[#1E1E1E] px-6 py-4 z-[1000]">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/o/${org.slug}`)}
              className="w-10 h-10 border-2 border-[#1E1E1E] rounded-full flex items-center justify-center hover:bg-[#F6F0EA]"
            >
              ←
            </button>
            <div>
              <h1 className="font-bold text-xl">{campaign.title}</h1>
              <p className="text-sm text-[#6B6B6B]">{campaign.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Category Filter Panel */}
      <div className="absolute top-24 right-6 bg-white border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden z-[1000] w-72">
        <button
          onClick={() => setCategoriesOpen(!categoriesOpen)}
          className="w-full px-4 py-3 font-bold text-sm text-left border-b-2 border-[#1E1E1E] hover:bg-[#F6F0EA] flex items-center justify-between"
        >
          <span className="text-[#6B6B6B] uppercase tracking-wider">CATEGORIES</span>
          <span>{categoriesOpen ? "−" : "+"}</span>
        </button>
        {categoriesOpen && (
          <div className="p-2">
            <button
              onClick={() => setFilterCategory("all")}
              className={`w-full text-left px-3 py-2 rounded-[12px] text-sm font-medium mb-1 flex items-center gap-2 ${
                filterCategory === "all"
                  ? "bg-[#06B6D4] text-[#1E1E1E]"
                  : "hover:bg-[#F6F0EA]"
              }`}
            >
              All Issues
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterCategory(key as PinCategory)}
                className={`w-full text-left px-3 py-2 rounded-[12px] text-sm font-medium mb-1 flex items-center gap-2 ${
                  filterCategory === key
                    ? "bg-[#06B6D4] text-[#1E1E1E]"
                    : "hover:bg-[#F6F0EA]"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[key as PinCategory] }}
                />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent Reports Panel */}
      <div className="absolute top-24 left-6 bg-white border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden z-[1000] w-80">
        <div className="px-4 py-3 border-b-2 border-[#1E1E1E]">
          <span className="text-[#6B6B6B] font-bold text-sm uppercase tracking-wider">
            RECENT REPORTS
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {filteredPins.length === 0 ? (
            <div className="p-6 text-center text-[#6B6B6B] text-sm">
              No reports yet
            </div>
          ) : (
            filteredPins.map((pin) => (
              <button
                key={pin.id}
                onClick={() => {
                  setSelectedPin(pin);
                  mapRef.current?.flyTo([pin.lat, pin.lng], 15);
                }}
                className="w-full px-4 py-3 border-b border-[#E5E5E5] hover:bg-[#F6F0EA] text-left flex items-center gap-3"
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[pin.category] }}
                />
                <span className="font-medium text-sm truncate">{pin.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* MAP AN ISSUE Button */}
      {campaignActive && membership && (
        <Link
          href={`/o/${org.slug}/c/${campaign.id}/add`}
          className="absolute bottom-8 right-6 z-[1000] px-8 py-4 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[16px] font-bold text-[#1E1E1E] hover:bg-[#0891B2] transition-all text-lg flex items-center gap-2 shadow-lg"
        >
          <span className="text-2xl">+</span>
          MAP AN ISSUE
        </Link>
      )}

      {/* Pin Detail Popup */}
      {selectedPin && (
        <div className="absolute bottom-0 left-0 right-0 z-[1001] bg-white border-t-2 border-[#1E1E1E] shadow-lg">
          <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[selectedPin.category] }}
                  />
                  <span className="text-sm font-medium text-[#6B6B6B]">
                    {CATEGORY_LABELS[selectedPin.category]}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{selectedPin.title}</h3>
                <p className="text-sm text-[#6B6B6B] line-clamp-2">
                  {selectedPin.description}
                </p>
              </div>
              {selectedPin.photo_url && (
                <img
                  src={selectedPin.photo_url}
                  alt={selectedPin.title}
                  className="w-24 h-24 rounded-[12px] border-2 border-[#1E1E1E] object-cover ml-4"
                />
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/o/${org.slug}/c/${campaign.id}/pin/${selectedPin.id}`}
                className="flex-1 text-center px-6 py-3 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[16px] font-bold text-[#1E1E1E] hover:bg-[#0891B2] transition-all"
              >
                VIEW DETAILS
              </Link>
              <button
                onClick={() => setSelectedPin(null)}
                className="px-6 py-3 border-2 border-[#1E1E1E] rounded-[16px] font-bold text-[#1E1E1E] hover:bg-[#F6F0EA] transition-all"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
