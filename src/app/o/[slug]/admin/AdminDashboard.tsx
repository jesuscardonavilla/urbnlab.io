"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Boundary, Campaign, Pin, Comment, PinStatus } from "@/types";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/types";
import { StatusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import BoundaryForm from "./BoundaryForm";
import CampaignForm from "./CampaignForm";

type Tab = "boundaries" | "campaigns" | "pins" | "comments" | "export";

interface Props {
  org: { id: string; name: string; slug: string };
  boundaries: Boundary[];
  campaigns: Campaign[];
  pins: Pin[];
  comments: Comment[];
  initialTab: string;
  userId: string;
}

export default function AdminDashboard({
  org,
  boundaries: initBoundaries,
  campaigns: initCampaigns,
  pins: initPins,
  comments: initComments,
  initialTab,
  userId,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>((initialTab as Tab) || "boundaries");
  const [boundaries, setBoundaries] = useState(initBoundaries);
  const [campaigns, setCampaigns] = useState(initCampaigns);
  const [pins, setPins] = useState(initPins);
  const [comments, setComments] = useState(initComments);
  const [showBoundaryForm, setShowBoundaryForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editBoundary, setEditBoundary] = useState<Boundary | null>(null);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [mergePinId, setMergePinId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const supabase = createClient();

  async function refreshData() {
    router.refresh();
  }

  // --- Pin moderation ---
  async function togglePinHidden(pin: Pin) {
    setActionLoading(`pin-${pin.id}`);
    const { error } = await supabase
      .from("pins")
      .update({ is_hidden: !pin.is_hidden })
      .eq("id", pin.id);
    if (!error) {
      setPins((prev) =>
        prev.map((p) => (p.id === pin.id ? { ...p, is_hidden: !p.is_hidden } : p))
      );
      // Log admin action
      await supabase.from("admin_actions").insert({
        org_id: org.id,
        actor_id: userId,
        action_type: pin.is_hidden ? "unhide_pin" : "hide_pin",
        target_table: "pins",
        target_id: pin.id,
        details: {},
      });
    }
    setActionLoading(null);
  }

  async function updatePinStatus(pin: Pin, status: PinStatus) {
    setActionLoading(`status-${pin.id}`);
    const { error } = await supabase
      .from("pins")
      .update({ status })
      .eq("id", pin.id);
    if (!error) {
      setPins((prev) =>
        prev.map((p) => (p.id === pin.id ? { ...p, status } : p))
      );
      await supabase.from("admin_actions").insert({
        org_id: org.id,
        actor_id: userId,
        action_type: "set_status",
        target_table: "pins",
        target_id: pin.id,
        details: { status },
      });
    }
    setActionLoading(null);
  }

  async function mergeDuplicate(duplicatePinId: string, canonicalPinId: string, reason = "") {
    if (!canonicalPinId.trim()) return;
    setActionLoading(`merge-${duplicatePinId}`);
    const { error } = await supabase
      .from("pins")
      .update({ canonical_pin_id: canonicalPinId, merged_reason: reason })
      .eq("id", duplicatePinId);
    if (!error) {
      setPins((prev) =>
        prev.map((p) =>
          p.id === duplicatePinId
            ? { ...p, canonical_pin_id: canonicalPinId, merged_reason: reason }
            : p
        )
      );
      await supabase.from("admin_actions").insert({
        org_id: org.id,
        actor_id: userId,
        action_type: "merge_pin",
        target_table: "pins",
        target_id: duplicatePinId,
        details: { canonical_pin_id: canonicalPinId },
      });
      setMergePinId(null);
      setMergeTargetId("");
    }
    setActionLoading(null);
  }

  // --- Comment moderation ---
  async function toggleCommentHidden(comment: Comment) {
    setActionLoading(`comment-${comment.id}`);
    const { error } = await supabase
      .from("comments")
      .update({ is_hidden: !comment.is_hidden })
      .eq("id", comment.id);
    if (!error) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id ? { ...c, is_hidden: !c.is_hidden } : c
        )
      );
      await supabase.from("admin_actions").insert({
        org_id: org.id,
        actor_id: userId,
        action_type: comment.is_hidden ? "unhide_comment" : "hide_comment",
        target_table: "comments",
        target_id: comment.id,
        details: {},
      });
    }
    setActionLoading(null);
  }

  // --- Delete boundary ---
  async function deleteBoundary(id: string) {
    if (!confirm("Delete this boundary? This cannot be undone.")) return;
    const { error } = await supabase.from("boundaries").delete().eq("id", id);
    if (!error) {
      setBoundaries((prev) => prev.filter((b) => b.id !== id));
    } else {
      alert("Cannot delete: " + error.message);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "boundaries", label: "Boundaries" },
    { key: "campaigns", label: "Campaigns" },
    { key: "pins", label: "Pins" },
    { key: "comments", label: "Comments" },
    { key: "export", label: "Export" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{org.name} — Admin</h1>
          <p className="text-sm text-[#6B6B6B]">Manage your organization</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-2 border-[#1E1E1E] rounded-[16px] p-1 bg-white w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-[12px] text-sm font-medium transition-all ${
              activeTab === t.key
                ? "bg-[#1E1E1E] text-white"
                : "text-[#6B6B6B] hover:bg-[#F6F0EA]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* BOUNDARIES TAB */}
      {activeTab === "boundaries" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Boundaries</h2>
            <Button
              onClick={() => {
                setEditBoundary(null);
                setShowBoundaryForm(true);
              }}
              size="sm"
            >
              + New boundary
            </Button>
          </div>

          {showBoundaryForm && (
            <div className="mb-4">
              <BoundaryForm
                orgId={org.id}
                boundary={editBoundary}
                onSave={(b) => {
                  if (editBoundary) {
                    setBoundaries((prev) =>
                      prev.map((x) => (x.id === b.id ? b : x))
                    );
                  } else {
                    setBoundaries((prev) => [b, ...prev]);
                  }
                  setShowBoundaryForm(false);
                  setEditBoundary(null);
                }}
                onCancel={() => {
                  setShowBoundaryForm(false);
                  setEditBoundary(null);
                }}
              />
            </div>
          )}

          {boundaries.length === 0 ? (
            <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-8 text-center text-[#6B6B6B]">
              No boundaries yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {boundaries.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-4 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-[#6B6B6B]">
                      Center: {b.center_lat?.toFixed(4)}, {b.center_lng?.toFixed(4)} · Zoom: {b.default_zoom}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditBoundary(b);
                        setShowBoundaryForm(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => deleteBoundary(b.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {activeTab === "campaigns" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Campaigns</h2>
            <Button
              onClick={() => {
                setEditCampaign(null);
                setShowCampaignForm(true);
              }}
              size="sm"
              disabled={boundaries.length === 0}
              title={boundaries.length === 0 ? "Create a boundary first" : undefined}
            >
              + New campaign
            </Button>
          </div>

          {boundaries.length === 0 && (
            <div className="bg-[#BFF3EC] border-2 border-[#2DD4BF] rounded-[12px] p-3 text-sm mb-4">
              You need at least one boundary before creating a campaign.{" "}
              <button
                className="underline font-medium"
                onClick={() => setActiveTab("boundaries")}
              >
                Create one now →
              </button>
            </div>
          )}

          {showCampaignForm && (
            <div className="mb-4">
              <CampaignForm
                orgId={org.id}
                boundaries={boundaries}
                campaign={editCampaign}
                userId={userId}
                onSave={(c) => {
                  if (editCampaign) {
                    setCampaigns((prev) =>
                      prev.map((x) => (x.id === c.id ? c : x))
                    );
                  } else {
                    setCampaigns((prev) => [c, ...prev]);
                  }
                  setShowCampaignForm(false);
                  setEditCampaign(null);
                }}
                onCancel={() => {
                  setShowCampaignForm(false);
                  setEditCampaign(null);
                }}
              />
            </div>
          )}

          {campaigns.length === 0 ? (
            <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-8 text-center text-[#6B6B6B]">
              No campaigns yet.
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const now = new Date();
                const start = new Date(c.start_at);
                const end = new Date(c.end_at);
                const isActive = start <= now && now <= end;

                return (
                  <div
                    key={c.id}
                    className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{c.title}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            isActive
                              ? "bg-[#BFF3EC] border-[#2DD4BF]"
                              : "bg-gray-100 border-gray-300 text-gray-500"
                          }`}
                        >
                          {isActive ? "Active" : now > end ? "Ended" : "Upcoming"}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B6B6B]">
                        {start.toLocaleDateString()} – {end.toLocaleDateString()}
                        {(c as Campaign & { boundary?: { name: string } }).boundary &&
                          ` · ${(c as Campaign & { boundary?: { name: string } }).boundary?.name}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditCampaign(c);
                          setShowCampaignForm(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PINS MODERATION TAB */}
      {activeTab === "pins" && (
        <div>
          <h2 className="text-lg font-bold mb-4">Pin Moderation</h2>
          {pins.length === 0 ? (
            <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-8 text-center text-[#6B6B6B]">
              No pins yet.
            </div>
          ) : (
            <div className="space-y-3">
              {pins.map((pin) => (
                <div
                  key={pin.id}
                  className={`bg-white border-2 border-[#1E1E1E] rounded-[16px] p-4 ${
                    pin.is_hidden ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium truncate">{pin.title}</p>
                        <StatusBadge status={pin.status} />
                        {pin.is_hidden && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                            Hidden
                          </span>
                        )}
                        {pin.canonical_pin_id && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            Merged duplicate
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B6B6B]">
                        {CATEGORY_LABELS[pin.category]} ·{" "}
                        {pin.profile?.email ?? "unknown"} ·{" "}
                        {new Date(pin.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Status selector */}
                      <select
                        value={pin.status}
                        onChange={(e) => updatePinStatus(pin, e.target.value as PinStatus)}
                        disabled={actionLoading === `status-${pin.id}`}
                        className="text-xs border-2 border-[#1E1E1E] rounded-[10px] px-2 py-1 bg-white outline-none"
                      >
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>

                      {/* Hide/unhide */}
                      <Button
                        size="sm"
                        variant={pin.is_hidden ? "secondary" : "danger"}
                        disabled={actionLoading === `pin-${pin.id}`}
                        onClick={() => togglePinHidden(pin)}
                      >
                        {pin.is_hidden ? "Unhide" : "Hide"}
                      </Button>

                      {/* Merge */}
                      {!pin.canonical_pin_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setMergePinId(pin.id)}
                        >
                          Merge
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Merge form */}
                  {mergePinId === pin.id && (
                    <div className="mt-3 flex gap-2 items-center border-t pt-3">
                      <div className="flex-1">
                        <label className="text-xs text-[#6B6B6B] block mb-1">
                          Canonical pin ID (the &quot;main&quot; pin this is a duplicate of):
                        </label>
                        <input
                          value={mergeTargetId}
                          onChange={(e) => setMergeTargetId(e.target.value)}
                          placeholder="Paste target pin UUID"
                          className="w-full border-2 border-[#1E1E1E] rounded-[10px] px-2 py-1 text-xs outline-none"
                        />
                      </div>
                      <Button
                        size="sm"
                        disabled={!mergeTargetId.trim() || actionLoading === `merge-${pin.id}`}
                        onClick={() => mergeDuplicate(pin.id, mergeTargetId)}
                      >
                        Confirm merge
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setMergePinId(null);
                          setMergeTargetId("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* COMMENTS MODERATION TAB */}
      {activeTab === "comments" && (
        <div>
          <h2 className="text-lg font-bold mb-4">Comment Moderation</h2>
          {comments.length === 0 ? (
            <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-8 text-center text-[#6B6B6B]">
              No comments yet.
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`bg-white border-2 border-[#1E1E1E] rounded-[16px] p-4 flex items-start gap-3 ${
                    c.is_hidden ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium">
                        {c.profile?.email ?? "unknown"}
                      </span>
                      <span className="text-xs text-[#6B6B6B]">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      {c.is_hidden && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{c.body}</p>
                    {(c as Comment & { pin?: { title: string } }).pin && (
                      <p className="text-xs text-[#6B6B6B] mt-1">
                        On pin: {(c as Comment & { pin?: { title: string } }).pin?.title}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={c.is_hidden ? "secondary" : "danger"}
                    disabled={actionLoading === `comment-${c.id}`}
                    onClick={() => toggleCommentHidden(c)}
                  >
                    {c.is_hidden ? "Unhide" : "Hide"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EXPORT TAB */}
      {activeTab === "export" && (
        <div>
          <h2 className="text-lg font-bold mb-2">Export Data</h2>
          <p className="text-sm text-[#6B6B6B] mb-6">
            Download CSV files for your organization. Emails and personal data are excluded.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { type: "campaigns", label: "Campaigns", desc: "All campaigns with dates and settings" },
              { type: "pins", label: "Pins", desc: "All pins (lat/lng rounded, no emails)" },
              { type: "votes", label: "Vote counts", desc: "Aggregated votes per pin" },
              { type: "comments", label: "Comments", desc: "All comments (no emails)" },
            ].map((e) => (
              <div
                key={e.type}
                className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-5"
              >
                <h3 className="font-bold mb-1">{e.label}</h3>
                <p className="text-sm text-[#6B6B6B] mb-3">{e.desc}</p>
                <a
                  href={`/api/export?org=${org.id}&type=${e.type}`}
                  download={`${e.type}.csv`}
                  className="inline-flex items-center gap-1 text-sm px-4 py-2 bg-[#2DD4BF] border-2 border-[#1E1E1E] rounded-[14px] font-medium hover:bg-[#1E1E1E] hover:text-white transition-all"
                >
                  ↓ Download {e.label}.csv
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
