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
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-1">Add a pin</h1>
      <p className="text-sm text-[#6B6B6B] mb-6">
        Click the map to drop your pin, then fill in the details below.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map */}
        <div>
          <div
            ref={mapContainer}
            className="w-full rounded-[16px] border-2 border-[#1E1E1E] overflow-hidden"
            style={{ height: "400px" }}
          />
          {lat && lng ? (
            <p className="text-xs text-[#6B6B6B] mt-2">
              📍 {lat.toFixed(5)}, {lng.toFixed(5)}
              {!insideBoundary && (
                <span className="text-red-500 ml-2 font-medium">
                  ⚠ Outside boundary — move pin inside the outlined area
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-[#6B6B6B] mt-2">
              Click anywhere inside the teal boundary outline to place your pin. You can drag it to adjust.
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="Short description of the issue"
              className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="What's the issue? What should be done?"
              className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PinCategory)}
                className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm bg-white outline-none"
              >
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
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Severity ({severity}/5)
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="w-full mt-2 accent-[#2DD4BF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">When does it occur?</label>
            <select
              value={timePattern}
              onChange={(e) => setTimePattern(e.target.value as TimePattern)}
              className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm bg-white outline-none"
            >
              {Object.entries(TIME_PATTERN_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Who is impacted?</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(IMPACTED_GROUP_LABELS) as [ImpactedGroup, string][]).map(
                ([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleGroup(k)}
                    className={`text-xs px-2 py-1 rounded-[12px] border-2 transition-all ${
                      impactedGroups.includes(k)
                        ? "bg-[#2DD4BF] border-[#1E1E1E]"
                        : "bg-white border-[#1E1E1E] text-[#6B6B6B]"
                    }`}
                  >
                    {v}
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Photo (optional)</label>
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-sm" />
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Preview"
                className="mt-2 rounded-[12px] border-2 border-[#1E1E1E] max-h-32 object-cover"
              />
            )}
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-[12px] px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Submitting…" : "Submit pin"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
