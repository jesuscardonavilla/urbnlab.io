"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import type { Boundary } from "@/types";

interface Props {
  orgId: string;
  boundary: Boundary | null;
  onSave: (b: Boundary) => void;
  onCancel: () => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  geojson: {
    type: string;
    coordinates: unknown;
  };
}

export default function BoundaryForm({ orgId, boundary, onSave, onCancel }: Props) {
  const supabase = createClient();
  const [name, setName] = useState(boundary?.name ?? "");
  const [geojsonText, setGeojsonText] = useState(
    boundary?.geog_json ?? ""
  );
  const [centerLat, setCenterLat] = useState(boundary?.center_lat?.toString() ?? "");
  const [centerLng, setCenterLng] = useState(boundary?.center_lng?.toString() ?? "");
  const [defaultZoom, setDefaultZoom] = useState(boundary?.default_zoom?.toString() ?? "13");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // City search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      // Nominatim OpenStreetMap API — free, no key needed
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchQuery
      )}&format=json&polygon_geojson=1&limit=5&featuretype=settlement`;

      const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "UrbanMaps/1.0" },
      });
      const data: NominatimResult[] = await res.json();

      // Only keep results that have a Polygon or MultiPolygon
      const withPolygon = data.filter(
        (r) => r.geojson?.type === "Polygon" || r.geojson?.type === "MultiPolygon"
      );

      if (withPolygon.length === 0) {
        setSearchError("No boundary polygon found for that name. Try adding the state, e.g. 'Traverse City, Michigan'.");
      } else {
        setSearchResults(withPolygon);
      }
    } catch {
      setSearchError("Search failed — check your internet connection.");
    }
    setSearching(false);
  }

  function applyResult(result: NominatimResult) {
    let geometry = result.geojson;

    // If MultiPolygon, take the polygon with the most coordinates (= largest area)
    if (geometry.type === "MultiPolygon") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const polys = (geometry.coordinates as any[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coordCount = (poly: any[]) => poly.reduce((sum: number, ring: any[]) => sum + ring.length, 0);
      const largest = polys.reduce((a, b) => (coordCount(a) >= coordCount(b) ? a : b));
      geometry = { type: "Polygon", coordinates: largest };
    }

    const geoStr = JSON.stringify(geometry, null, 2);
    setGeojsonText(geoStr);
    setCenterLat(parseFloat(result.lat).toFixed(6));
    setCenterLng(parseFloat(result.lon).toFixed(6));

    // Auto-fill name if empty
    if (!name) {
      // Use first part of display_name (city/township name)
      setName(result.display_name.split(",")[0].trim());
    }

    setSearchResults([]);
    setSearchQuery("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    let parsed;
    try {
      parsed = JSON.parse(geojsonText);
    } catch {
      setError("Invalid GeoJSON — check your paste.");
      return;
    }

    const geometry = parsed.type === "Feature" ? parsed.geometry : parsed;

    if (geometry.type !== "Polygon") {
      setError("GeoJSON must be a Polygon. If the city returned a MultiPolygon, use the search to auto-select the largest part.");
      return;
    }

    setLoading(true);

    let lat = parseFloat(centerLat);
    let lng = parseFloat(centerLng);
    if (!lat || !lng) {
      const coords: [number, number][] = geometry.coordinates[0];
      const lats = coords.map((c) => c[1]);
      const lngs = coords.map((c) => c[0]);
      lat = (Math.min(...lats) + Math.max(...lats)) / 2;
      lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    }

    const geojsonStr = JSON.stringify(geometry);

    // PostGIS GEOGRAPHY column requires WKT, not raw GeoJSON
    const ringToWkt = (ring: [number, number][]) =>
      ring.map(([ln, la]) => `${ln} ${la}`).join(", ");
    const wkt = `SRID=4326;POLYGON((${ringToWkt(geometry.coordinates[0])}))`;

    const payload = {
      org_id: orgId,
      name,
      geog: wkt,
      geog_json: geojsonStr,
      center_lat: lat,
      center_lng: lng,
      default_zoom: parseInt(defaultZoom) || 13,
    };

    if (boundary) {
      const { data, error: e } = await supabase
        .from("boundaries")
        .update(payload)
        .eq("id", boundary.id)
        .select()
        .single();
      if (e) setError(e.message);
      else onSave(data as Boundary);
    } else {
      const { data, error: e } = await supabase
        .from("boundaries")
        .insert(payload)
        .select()
        .single();
      if (e) setError(e.message);
      else onSave(data as Boundary);
    }

    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-5 space-y-4"
    >
      <h3 className="font-bold">{boundary ? "Edit boundary" : "New boundary"}</h3>

      {/* ── AUTO-SEARCH ── */}
      <div className="bg-[#BFF3EC] border-2 border-[#2DD4BF] rounded-[12px] p-4 space-y-3">
        <p className="text-sm font-medium">
          Search city / township automatically
        </p>
        <p className="text-xs text-[#6B6B6B]">
          Type any city, township, or county name and we&apos;ll fetch the real
          official boundary from OpenStreetMap — no drawing needed.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
            placeholder="e.g. Traverse City, Michigan"
            className="flex-1 border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF] bg-white"
          />
          <Button
            type="button"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            size="sm"
          >
            {searching ? "Searching…" : "Search"}
          </Button>
        </div>

        {searchError && (
          <p className="text-red-600 text-xs">{searchError}</p>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-[#6B6B6B] font-medium">
              Select a result:
            </p>
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyResult(r)}
                className="w-full text-left text-xs px-3 py-2 bg-white border-2 border-[#1E1E1E] rounded-[10px] hover:bg-[#F6F0EA] transition-colors"
              >
                <span className="font-medium">
                  {r.display_name.split(",").slice(0, 3).join(",")}
                </span>
                <span className="text-[#6B6B6B] ml-1">
                  ({r.geojson.type})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Traverse City limits"
          className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Boundary polygon (GeoJSON)
        </label>
        <p className="text-xs text-[#6B6B6B] mb-2">
          Auto-filled by the search above. You can also paste manually from{" "}
          <a
            href="https://geojson.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            geojson.io
          </a>
          .
        </p>
        <textarea
          value={geojsonText}
          onChange={(e) => setGeojsonText(e.target.value)}
          required
          rows={6}
          placeholder='{"type":"Polygon","coordinates":[...]}'
          className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-xs font-mono outline-none focus:border-[#2DD4BF] resize-y"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Center Lat</label>
          <input
            value={centerLat}
            onChange={(e) => setCenterLat(e.target.value)}
            placeholder="Auto"
            type="number"
            step="any"
            className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Center Lng</label>
          <input
            value={centerLng}
            onChange={(e) => setCenterLng(e.target.value)}
            placeholder="Auto"
            type="number"
            step="any"
            className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default zoom</label>
          <input
            value={defaultZoom}
            onChange={(e) => setDefaultZoom(e.target.value)}
            type="number"
            min={8}
            max={18}
            className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : boundary ? "Update boundary" : "Create boundary"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
