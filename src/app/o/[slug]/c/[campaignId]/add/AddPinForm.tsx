"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import type { Campaign, PinCategory, TimePattern, ImpactedGroup } from "@/types";
import {
  CATEGORY_LABELS,
  CATEGORY_GROUPS,
  TIME_PATTERN_LABELS,
  IMPACTED_GROUP_LABELS,
} from "@/types";

interface Props {
  campaign: Campaign;
  org: { id: string; name: string; slug: string };
  userId: string;
}

// Point-in-polygon (ray casting) — GeoJSON coords are [lng, lat]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pointInPolygon(lngLat: [number, number], polygon: any): boolean {
  try {
    const coords: [number, number][] = polygon.coordinates?.[0] ?? [];
    let inside = false;
    const [px, py] = lngLat;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const [xi, yi] = coords[i];
      const [xj, yj] = coords[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  } catch {
    return true;
  }
}

export default function AddPinForm({ campaign, org, userId }: Props) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [insideBoundary, setInsideBoundary] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<PinCategory>(
    campaign.enabled_categories?.[0] ?? "crosswalk_needed"
  );
  const [severity, setSeverity] = useState(3);
  const [timePattern, setTimePattern] = useState<TimePattern>("always");
  const [impactedGroups, setImpactedGroups] = useState<ImpactedGroup[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const boundary = campaign.boundary;
  const boundaryGeoJSON = boundary?.geog_json
    ? JSON.parse(boundary.geog_json)
    : null;

  useEffect(() => {
    if (!mapContainer.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current) return;

      const map = L.map(mapContainer.current!, {
        center: [boundary?.center_lat ?? 44.7631, boundary?.center_lng ?? -85.6206],
        zoom: boundary?.default_zoom ?? 12,
        zoomControl: false,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      if (boundaryGeoJSON) {
        const boundsLayer = L.geoJSON(boundaryGeoJSON);

        // Inverse mask — gray out everything outside the boundary
        const worldRing: [number, number][] = [
          [-180, -89.99], [180, -89.99], [180, 89.99], [-180, 89.99], [-180, -89.99],
        ];
        const boundaryRing: [number, number][] = boundaryGeoJSON.coordinates[0];

        L.geoJSON(
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
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

      // Click to place / move pin
      map.on("click", (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;

        if (boundaryGeoJSON) {
          const inside = pointInPolygon([clickLng, clickLat], boundaryGeoJSON);
          setInsideBoundary(inside);
        }

        setLat(clickLat);
        setLng(clickLng);

        const pinIcon = L.divIcon({
          className: "",
          html: `<div style="
            width:28px;height:28px;
            background:#2DD4BF;border:2px solid #1E1E1E;
            border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            cursor:grab;box-shadow:0 2px 6px rgba(0,0,0,0.2);
          "></div>`,
          iconSize: [28, 28],
          iconAnchor: [2, 26],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          const marker = L.marker([clickLat, clickLng], {
            icon: pinIcon,
            draggable: true,
          }).addTo(map);

          marker.on("dragend", () => {
            const pos = marker.getLatLng();
            if (boundaryGeoJSON) {
              setInsideBoundary(pointInPolygon([pos.lng, pos.lat], boundaryGeoJSON));
            }
            setLat(pos.lat);
            setLng(pos.lng);
          });

          markerRef.current = marker;
        }
      });

      mapRef.current = map;
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be under 5 MB."); return; }
    if (!file.type.startsWith("image/")) { setError("Only image files are allowed."); return; }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  }

  function toggleGroup(g: ImpactedGroup) {
    setImpactedGroups((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lat || !lng) { setError("Click on the map to place your pin."); return; }
    if (!insideBoundary) { setError("Pin must be inside the campaign boundary."); return; }
    if (!title.trim()) { setError("Title is required."); return; }
    if (!description.trim()) { setError("Description is required."); return; }

    setLoading(true);
    setError("");
    const supabase = createClient();

    let photoUrl: string | null = null;
    if (photo) {
      const ext = photo.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("pin-photos")
        .upload(path, photo, { contentType: photo.type });
      if (uploadErr) {
        setError("Photo upload failed: " + uploadErr.message);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("pin-photos").getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const { error: insertErr } = await supabase.from("pins").insert({
      org_id: org.id,
      campaign_id: campaign.id,
      boundary_id: campaign.boundary_id,
      user_id: userId,
      category,
      severity,
      time_pattern: timePattern,
      impacted_groups: impactedGroups,
      title: title.trim(),
      description: description.trim(),
      photo_url: photoUrl,
      lat,
      lng,
      geog: `SRID=4326;POINT(${lng} ${lat})`,
    });

    if (insertErr) {
      setError(insertErr.message);
      setLoading(false);
      return;
    }

    router.push(`/o/${org.slug}/c/${campaign.id}`);
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b-2 border-[#1E1E1E] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 hover:bg-[#F6F0EA] rounded-full transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
          <h1 className="text-xl font-bold">Add Mobility Issue</h1>
          <div className="w-10 h-10 flex items-center justify-center">
            <span className="text-xl text-[#06B6D4]">?</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Location - Large Map at Top */}
        <div>
          <div className="relative border-2 border-[#1E1E1E] overflow-hidden">
            <div
              ref={mapContainer}
              className="w-full"
              style={{ height: "400px" }}
            />
            {!lat || !lng ? (
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none">
                <div className="bg-white px-6 py-3 rounded-full border-2 border-[#1E1E1E] font-bold flex items-center gap-2">
                  <span className="text-[#06B6D4] text-xl">📍</span>
                  Click map to place pin
                </div>
              </div>
            ) : null}
          </div>
          {lat && lng && (
            <div className="bg-white border-2 border-[#1E1E1E] border-t-0 px-4 py-3">
              <p className="text-sm text-[#1E1E1E]">
                📍 Pin placed at: {lat.toFixed(5)}, {lng.toFixed(5)}
                {!insideBoundary && (
                  <span className="text-red-600 ml-2 font-bold">
                    ⚠ Move pin inside campaign boundary
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto px-6 space-y-6">
          {/* Issue Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-[#1E1E1E] mb-2">
              ISSUE TITLE
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="e.g., Blocked sidewalk on 5th Ave"
              className="w-full border-2 border-[#E5E5E5] rounded-[12px] px-4 py-3 text-base outline-none focus:border-[#06B6D4] placeholder:text-[#9CA3AF]"
            />
          </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-[#1E1E1E] mb-2">
            CATEGORY
          </label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PinCategory)}
              className="w-full border-2 border-[#E5E5E5] rounded-[12px] px-4 py-3 text-base bg-white outline-none focus:border-[#06B6D4] appearance-none"
            >
              <option value="">Select mobility type</option>
              {CATEGORY_GROUPS.map((group) => {
                const enabled = campaign.enabled_categories ?? (Object.keys(CATEGORY_LABELS) as PinCategory[]);
                const options = group.categories.filter((c) => enabled.includes(c));
                if (options.length === 0) return null;
                return (
                  <optgroup key={group.label} label={group.label}>
                    {options.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B6B6B]">
              ▼
            </div>
          </div>
        </div>

        {/* Severity */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wide text-[#1E1E1E]">
              SEVERITY
            </label>
            <span className="text-sm font-bold text-[#06B6D4]">
              {severity} {severity === 1 ? "Star" : "Stars"}
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min={1}
              max={5}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="w-full h-2 bg-[#E5E5E5] rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #06B6D4 0%, #06B6D4 ${((severity - 1) / 4) * 100}%, #E5E5E5 ${((severity - 1) / 4) * 100}%, #E5E5E5 100%)`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#6B6B6B] mt-2">
            <span>Minor</span>
            <span>Moderate</span>
            <span>Critical</span>
          </div>
        </div>

        {/* Time Pattern */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-[#1E1E1E] mb-2">
            TIME PATTERN
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TIME_PATTERN_LABELS) as [TimePattern, string][]).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTimePattern(k)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  timePattern === k
                    ? "bg-[#06B6D4] text-white"
                    : "bg-white text-[#1E1E1E] border-2 border-[#E5E5E5]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Impacted Groups */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-[#1E1E1E] mb-2">
            IMPACTED GROUPS
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(IMPACTED_GROUP_LABELS) as [ImpactedGroup, string][]).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleGroup(k)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  impactedGroups.includes(k)
                    ? "bg-[#06B6D4] text-white"
                    : "bg-white text-[#1E1E1E] border-2 border-[#E5E5E5]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-[#1E1E1E] mb-2">
            DESCRIPTION
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            placeholder="Provide details about the issue..."
            className="w-full border-2 border-[#E5E5E5] rounded-[12px] px-4 py-3 text-base outline-none focus:border-[#06B6D4] resize-none placeholder:text-[#9CA3AF]"
          />
        </div>

        {/* Upload Evidence */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-[#1E1E1E] mb-2">
            UPLOAD EVIDENCE
          </label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              id="photo-upload"
            />
            {photoPreview ? (
              <div className="relative border-2 border-[#E5E5E5] rounded-[12px] overflow-hidden">
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-white border-2 border-[#1E1E1E] rounded-full flex items-center justify-center font-bold"
                >
                  ×
                </button>
              </div>
            ) : (
              <label
                htmlFor="photo-upload"
                className="block border-2 border-dashed border-[#E5E5E5] rounded-[12px] py-12 text-center cursor-pointer hover:border-[#06B6D4] transition-colors"
              >
                <div className="flex flex-col items-center gap-2">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9CA3AF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <p className="text-sm text-[#9CA3AF]">Tap to upload or take a photo</p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-[12px] px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[16px] font-bold text-lg text-[#1E1E1E] hover:bg-[#0891B2] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Submitting Issue..." : "Submit Issue"}
        </button>
      </div>
      </form>
    </div>
  );
}
