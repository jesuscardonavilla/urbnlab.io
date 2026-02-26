"use client";

import { useState } from "react";
import type { Boundary, Campaign, Pin } from "@/types";
import CampaignForm from "./CampaignForm";

interface Props {
  campaigns: Campaign[];
  boundaries: Boundary[];
  org: { id: string; name: string; slug: string };
  userId: string;
  pins: Pin[];
}

function daysLeft(endAt: string): number {
  return Math.max(0, Math.ceil((new Date(endAt).getTime() - Date.now()) / 86400000));
}

function campaignStatus(c: Campaign): "active" | "scheduled" | "ended" {
  const now = new Date();
  if (new Date(c.end_at) < now) return "ended";
  if (new Date(c.start_at) > now) return "scheduled";
  return "active";
}

const CARD_GRADIENTS = {
  active: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
  scheduled: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
  ended: "linear-gradient(135deg, #6B6B6B 0%, #9B9B9B 100%)",
};

const STATUS_BADGE = {
  active: "bg-green-500 text-white",
  scheduled: "bg-yellow-400 text-[#1E1E1E]",
  ended: "bg-gray-500 text-white",
};

const FILTER_TABS: { key: "all" | "active" | "scheduled" | "ended"; label: string }[] = [
  { key: "all", label: "All Campaigns" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "ended", label: "Ended" },
];

export default function AdminCampaignsTab({
  campaigns: initialCampaigns,
  boundaries,
  org,
  userId,
  pins,
}: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showForm, setShowForm] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "scheduled" | "ended">("all");

  const filtered = campaigns.filter((c) =>
    filterTab === "all" ? true : campaignStatus(c) === filterTab
  );

  const activeCampaigns = campaigns.filter((c) => campaignStatus(c) === "active");
  const totalReports = pins.length;
  const totalCompleted = pins.filter((p) => p.status === "completed").length;
  const overallPct = totalReports > 0 ? Math.round((totalCompleted / totalReports) * 100) : 0;
  const uniqueUsers = new Set(pins.map((p) => p.user_id)).size;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[#1E1E1E]">Admin Campaigns</h2>
          <p className="text-sm text-[#6B6B6B] mt-0.5">Manage and track mobility improvement campaigns.</p>
        </div>
        <button
          onClick={() => { setEditCampaign(null); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#06B6D4] border-2 border-[#1E1E1E] text-[#1E1E1E] rounded-[12px] text-sm font-bold hover:bg-[#0891B2] hover:text-white transition-all"
        >
          + New Campaign
        </button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="mb-6 bg-white border-2 border-[#1E1E1E] rounded-[16px] p-5">
          {boundaries.length === 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-[12px] p-4 mb-4">
              <p className="font-bold text-yellow-800 mb-1">No boundary set yet</p>
              <p className="text-sm text-yellow-700">
                Your campaign request will be submitted. The UrbanMaps team will assign a boundary and activate it.
              </p>
            </div>
          )}
          <CampaignForm
            orgId={org.id}
            boundaries={boundaries}
            campaign={editCampaign}
            userId={userId}
            onSave={(c) => {
              if (editCampaign) {
                setCampaigns((prev) => prev.map((x) => x.id === c.id ? c : x));
              } else {
                setCampaigns((prev) => [c, ...prev]);
              }
              setShowForm(false);
              setEditCampaign(null);
            }}
            onCancel={() => { setShowForm(false); setEditCampaign(null); }}
          />
        </div>
      )}

      {/* Underline filter tabs */}
      <div className="flex gap-6 mb-6 border-b-2 border-[#E5E5E5]">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`pb-3 text-sm font-bold transition-all relative ${
              filterTab === tab.key
                ? "text-[#1E1E1E]"
                : "text-[#9B9B9B] hover:text-[#6B6B6B]"
            }`}
          >
            {tab.label}
            {filterTab === tab.key && (
              <span className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-[#1E1E1E] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {filtered.map((c) => {
          const status = campaignStatus(c);
          const start = new Date(c.start_at);
          const end = new Date(c.end_at);
          const campaignPins = pins.filter((p) => p.campaign_id === c.id);
          const completedPins = campaignPins.filter((p) => p.status === "completed");
          const pct = campaignPins.length > 0
            ? Math.round((completedPins.length / campaignPins.length) * 100)
            : 0;

          return (
            <div
              key={c.id}
              className="bg-white border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Gradient image area */}
              <div
                className="h-40 relative"
                style={{ background: CARD_GRADIENTS[status] }}
              >
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(255,255,255,0.5) 20px, rgba(255,255,255,0.5) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.5) 20px, rgba(255,255,255,0.5) 21px)",
                  }}
                />
                {/* Report count badge */}
                <div className="absolute top-3 left-3 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 text-white text-xs font-bold">
                  {campaignPins.length} Reports
                </div>
                {/* Status badge */}
                <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[status]}`}>
                  {status === "active" ? "● ACTIVE" : status === "scheduled" ? "◐ SCHEDULED" : "○ ENDED"}
                </div>
                {/* Big letter watermark */}
                <div className="absolute bottom-2 left-3 text-white/20 text-7xl font-black leading-none select-none">
                  {c.title.charAt(0)}
                </div>
              </div>

              {/* Card body */}
              <div className="p-4">
                {/* Title + PUBLIC badge */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-[#1E1E1E] leading-tight flex-1">{c.title}</h3>
                  <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 bg-[#E0F7FA] border border-[#06B6D4] text-[#0891B2] rounded-full">
                    PUBLIC
                  </span>
                </div>

                {/* Date range */}
                <p className="text-xs text-[#9B9B9B] mb-3">
                  {start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} –{" "}
                  {end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>

                {/* Stats row + completion % */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#6B6B6B] font-medium">
                    {campaignPins.length} reports · {completedPins.length} resolved
                  </span>
                  <span className="text-xs font-bold text-[#1E1E1E]">{pct}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-[#10B981] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {status === "active" && (
                  <p className="text-[11px] text-[#6B6B6B] mb-3">
                    <span className="font-bold text-[#1E1E1E]">{daysLeft(c.end_at)}</span> days remaining
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditCampaign(c); setShowForm(true); }}
                    className="flex-1 px-3 py-2 border-2 border-[#1E1E1E] rounded-[10px] text-xs font-bold hover:bg-[#F6F0EA] transition-all"
                  >
                    Edit
                  </button>
                  <a
                    href={`/o/${org.slug}/c/${c.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 bg-[#1E1E1E] border-2 border-[#1E1E1E] rounded-[10px] text-xs font-bold text-white text-center hover:bg-[#333] transition-all"
                  >
                    View Map ↗
                  </a>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full bg-white border-2 border-[#1E1E1E] rounded-[16px] p-12 text-center">
            <p className="text-[#9B9B9B] font-medium">No campaigns found</p>
          </div>
        )}

        {/* Create new card */}
        {!showForm && (
          <button
            onClick={() => { setEditCampaign(null); setShowForm(true); }}
            className="bg-white border-2 border-dashed border-[#9B9B9B] rounded-[16px] p-8 flex flex-col items-center justify-center gap-3 text-[#9B9B9B] hover:border-[#1E1E1E] hover:text-[#1E1E1E] transition-all min-h-[280px]"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center text-2xl">
              +
            </div>
            <p className="font-bold text-sm">Create New Campaign</p>
            <p className="text-xs text-center leading-relaxed opacity-70">
              Initiate a new time-bound<br />mobility project
            </p>
          </button>
        )}
      </div>

      {/* Overall Campaign Completion */}
      <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-bold text-[#1E1E1E] text-base">Overall Campaign Completion</h3>
            <p className="text-sm text-[#6B6B6B] mt-0.5">Aggregated across all campaigns</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[#1E1E1E]">{overallPct}%</p>
            <p className="text-xs text-[#9B9B9B]">target reached</p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="h-3 bg-[#E5E5E5] rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-[#10B981] rounded-full transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>

        {/* 4 stat pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#F6F0EA] rounded-[12px] px-4 py-4 text-center">
            <p className="text-2xl font-bold text-[#1E1E1E]">{campaigns.length}</p>
            <p className="text-[10px] text-[#9B9B9B] uppercase font-bold tracking-wider mt-1">Total Campaigns</p>
          </div>
          <div className="bg-[#F0FDF4] rounded-[12px] px-4 py-4 text-center">
            <p className="text-2xl font-bold text-[#10B981]">{activeCampaigns.length}</p>
            <p className="text-[10px] text-[#9B9B9B] uppercase font-bold tracking-wider mt-1">Active Now</p>
          </div>
          <div className="bg-[#F6F0EA] rounded-[12px] px-4 py-4 text-center">
            <p className="text-2xl font-bold text-[#1E1E1E]">{totalReports}</p>
            <p className="text-[10px] text-[#9B9B9B] uppercase font-bold tracking-wider mt-1">Total Reports</p>
          </div>
          <div className="bg-[#E0F7FA] rounded-[12px] px-4 py-4 text-center">
            <p className="text-2xl font-bold text-[#06B6D4]">{uniqueUsers}</p>
            <p className="text-[10px] text-[#9B9B9B] uppercase font-bold tracking-wider mt-1">User Reach</p>
          </div>
        </div>
      </div>
    </div>
  );
}
