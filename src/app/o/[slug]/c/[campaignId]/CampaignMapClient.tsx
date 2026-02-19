"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { Campaign, Pin, PinCategory } from "@/types";
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_LABELS } from "@/types";
import { StatusBadge } from "@/components/ui/Badge";

interface Props {
  campaign: Campaign;
  pins: Pin[];
  org: { id: string; name: string; slug: string };
  membership: { role: string } | null;
  userId: string | null;
}

const TC = { lat: 44.7631, lng: -85.6206, zoom: 12 };

export default function CampaignMapClient({ campaign, pins, org, membership }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);

  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [filterCategory, setFilterCategory] = useState<PinCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [mapReady, setMapReady] = useState(false);

  const boundary = campaign.boundary;
  const boundaryGeoJSON = boundary?.geog_json
    ? JSON.parse(boundary.geog_json)
    : null;

  // Init map once
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
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (boundaryGeoJSON) {
        // Use a plain geoJSON layer just to compute bounds
        const boundsLayer = L.geoJSON(boundaryGeoJSON);

        // Inverse mask: world rectangle with the boundary as a hole.
        // Everything OUTSIDE the boundary gets a gray overlay.
        const worldRing: [number, number][] = [
          [-180, -89.99], [180, -89.99], [180, 89.99], [-180, 89.99], [-180, -89.99],
        ];
        const boundaryRing: [number, number][] = boundaryGeoJSON.coordinates[0];

        L.geoJSON(
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              // outer ring = world, inner ring = boundary hole
              coordinates: [worldRing, boundaryRing],
            } as GeoJSON.Geometry,
            properties: {},
          } as GeoJSON.Feature,
          {
            style: {
              fillColor: "#888888",
              fillOpacity: 0.45,
              stroke: false,
              weight: 0,
            },
          }
        ).addTo(map);

        // Dashed boundary outline
        L.geoJSON(boundaryGeoJSON, {
          style: {
            color: "#444444",
            weight: 2.5,
            dashArray: "8 5",
            fill: false,
          },
        }).addTo(map);

        try {
          const bounds = boundsLayer.getBounds();
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const padLat = (ne.lat - sw.lat) * 0.3;
          const padLng = (ne.lng - sw.lng) * 0.3;
          map.setMaxBounds([
            [sw.lat - padLat, sw.lng - padLng],
            [ne.lat + padLat, ne.lng + padLng],
          ]);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when filters or pins change
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
        if (filterStatus !== "all" && p.status !== filterStatus) return false;
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
    return () => {
      cancelled = true;
    };
  }, [pins, mapReady, filterCategory, filterStatus]);

  const filteredPins = pins.filter((p) => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  });

  const now = new Date();
  const campaignActive =
    new Date(campaign.start_at) <= now && now <= new Date(campaign.end_at);

  return (
    <div
      className="flex-1 flex flex-col md:flex-row overflow-hidden"
      style={{ height: "calc(100vh - 56px)" }}
    >
      {/* Sidebar */}
      <div className="w-full md:w-[340px] flex-shrink-0 flex flex-col overflow-hidden border-r-2 border-[#1E1E1E] bg-white">
        {/* Campaign header */}
        <div className="p-4 border-b-2 border-[#1E1E1E]">
          <div className="flex items-center gap-1 mb-1 text-xs text-[#6B6B6B]">
            <Link href={`/o/${org.slug}`} className="hover:underline">
              {org.name}
            </Link>
            <span>/</span>
            <span className="truncate">{campaign.title}</span>
          </div>
          <h1 className="font-bold text-lg leading-tight">{campaign.title}</h1>
          {campaign.description && (
            <p className="text-xs text-[#6B6B6B] mt-1">{campaign.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                campaignActive
                  ? "bg-[#BFF3EC] border-[#2DD4BF] text-[#1E1E1E]"
                  : "bg-gray-100 border-gray-300 text-gray-500"
              }`}
            >
              {campaignActive ? "Active" : "Ended"}
            </span>
            <span className="text-xs text-[#6B6B6B]">
              {new Date(campaign.start_at).toLocaleDateString()} –{" "}
              {new Date(campaign.end_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 border-b-2 border-[#1E1E1E] flex gap-2">
          {campaignActive &&
            (membership ? (
              <Link
                href={`/o/${org.slug}/c/${campaign.id}/add`}
                className="flex-1 text-center text-sm py-2 bg-[#2DD4BF] border-2 border-[#1E1E1E] rounded-[16px] font-medium hover:bg-[#1E1E1E] hover:text-white transition-all"
              >
                + Add pin
              </Link>
            ) : (
              <Link
                href={`/auth/login?next=/o/${org.slug}/c/${campaign.id}`}
                className="flex-1 text-center text-sm py-2 bg-white border-2 border-[#1E1E1E] rounded-[16px] hover:bg-[#F6F0EA] transition-all"
              >
                Sign in to add pin
              </Link>
            ))}
        </div>

        {/* Filters */}
        <div className="p-3 border-b-2 border-[#1E1E1E] flex flex-wrap gap-1.5">
          <select
            value={filterCategory}
            onChange={(e) =>
              setFilterCategory(e.target.value as PinCategory | "all")
            }
            className="text-xs border-2 border-[#1E1E1E] rounded-[12px] px-2 py-1 bg-white outline-none"
          >
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border-2 border-[#1E1E1E] rounded-[12px] px-2 py-1 bg-white outline-none"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* Pin list */}
        <div className="flex-1 overflow-y-auto">
          {filteredPins.length === 0 ? (
            <div className="p-6 text-center text-[#6B6B6B] text-sm">
              No pins yet. Be the first to add one!
            </div>
          ) : (
            filteredPins.map((pin) => (
              <div
                key={pin.id}
                onClick={() => {
                  setSelectedPin(pin);
                  mapRef.current?.flyTo([pin.lat, pin.lng], 15);
                }}
                className={`px-4 py-3 border-b border-[#E5E5E5] cursor-pointer hover:bg-[#F6F0EA] transition-colors ${
                  selectedPin?.id === pin.id ? "bg-[#F6F0EA]" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[pin.category] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{pin.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-xs text-[#6B6B6B]">
                        {CATEGORY_LABELS[pin.category]}
                      </span>
                      <StatusBadge status={pin.status} />
                    </div>
                  </div>
                  <span className="text-xs text-[#6B6B6B] flex-shrink-0">
                    ▲ {pin.vote_count ?? 0}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Selected pin card */}
        {selectedPin && (
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-[#1E1E1E] p-4 max-h-[45%] overflow-y-auto md:absolute md:top-4 md:right-4 md:left-auto md:bottom-auto md:w-80 md:rounded-[16px] md:border-2 md:max-h-[calc(100%-2rem)] z-[1000]">
            <div className="flex items-center justify-between mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[selectedPin.category] }}
              />
              <button
                onClick={() => setSelectedPin(null)}
                className="text-[#6B6B6B] hover:text-[#1E1E1E] text-xl leading-none ml-auto"
              >
                ×
              </button>
            </div>
            <h3 className="font-bold mb-1">{selectedPin.title}</h3>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-[#6B6B6B]">
                {CATEGORY_LABELS[selectedPin.category]}
              </span>
              <StatusBadge status={selectedPin.status} />
            </div>
            <p className="text-sm text-[#6B6B6B] mb-3 line-clamp-3">
              {selectedPin.description}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                ▲ {selectedPin.vote_count ?? 0} votes
              </span>
              <Link
                href={`/o/${org.slug}/c/${campaign.id}/pin/${selectedPin.id}`}
                className="text-sm px-3 py-1.5 bg-[#2DD4BF] border-2 border-[#1E1E1E] rounded-[12px] font-medium hover:bg-[#1E1E1E] hover:text-white transition-all"
              >
                View details →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
