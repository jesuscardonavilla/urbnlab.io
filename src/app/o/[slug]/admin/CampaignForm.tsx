"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import type { Boundary, Campaign, PinCategory } from "@/types";
import { CATEGORY_LABELS } from "@/types";

interface Props {
  orgId: string;
  boundaries: Boundary[];
  campaign: Campaign | null;
  userId: string;
  onSave: (c: Campaign) => void;
  onCancel: () => void;
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as PinCategory[];

export default function CampaignForm({
  orgId,
  boundaries,
  campaign,
  userId,
  onSave,
  onCancel,
}: Props) {
  const supabase = createClient();

  const [title, setTitle] = useState(campaign?.title ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [boundaryId, setBoundaryId] = useState(campaign?.boundary_id ?? boundaries[0]?.id ?? "");
  const [startAt, setStartAt] = useState(
    campaign?.start_at
      ? new Date(campaign.start_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [endAt, setEndAt] = useState(
    campaign?.end_at
      ? new Date(campaign.end_at).toISOString().slice(0, 16)
      : new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 16)
  );
  const [enabledCategories, setEnabledCategories] = useState<PinCategory[]>(
    campaign?.enabled_categories ?? ALL_CATEGORIES
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleCategory(c: PinCategory) {
    setEnabledCategories((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (enabledCategories.length === 0) {
      setError("Select at least one category.");
      return;
    }
    if (!boundaryId) {
      setError("Select a boundary.");
      return;
    }

    setLoading(true);

    const payload = {
      org_id: orgId,
      boundary_id: boundaryId,
      title,
      description: description || null,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      enabled_categories: enabledCategories,
      created_by: userId,
    };

    if (campaign) {
      const { data, error: e } = await supabase
        .from("campaigns")
        .update(payload)
        .eq("id", campaign.id)
        .select("*, boundary:boundaries(name)")
        .single();
      if (e) setError(e.message);
      else onSave(data as Campaign);
    } else {
      const { data, error: e } = await supabase
        .from("campaigns")
        .insert(payload)
        .select("*, boundary:boundaries(name)")
        .single();
      if (e) setError(e.message);
      else onSave(data as Campaign);
    }

    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-5 space-y-4"
    >
      <h3 className="font-bold">{campaign ? "Edit campaign" : "New campaign"}</h3>

      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Spring Mobility Fixes 2026"
          className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What are we collecting feedback on?"
          className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF] resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Boundary</label>
        <select
          value={boundaryId}
          onChange={(e) => setBoundaryId(e.target.value)}
          required
          className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm bg-white outline-none"
        >
          {boundaries.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Start date/time</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
            className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End date/time</label>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            required
            className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Enabled categories</label>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={`text-xs px-3 py-1.5 rounded-[12px] border-2 transition-all ${
                enabledCategories.includes(c)
                  ? "bg-[#2DD4BF] border-[#1E1E1E]"
                  : "bg-white border-[#1E1E1E] text-[#6B6B6B]"
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-xs text-[#2DD4BF] hover:underline mt-1"
          onClick={() => setEnabledCategories(ALL_CATEGORIES)}
        >
          Select all
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : campaign ? "Update campaign" : "Create campaign"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
