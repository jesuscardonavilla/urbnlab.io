"use client";

import { useState } from "react";
import type { Boundary, Campaign } from "@/types";
import CampaignForm from "./CampaignForm";

interface Props {
  campaigns: Campaign[];
  boundaries: Boundary[];
  org: { id: string; name: string; slug: string };
  userId: string;
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

const STATUS_STYLES = {
  active: "bg-green-100 text-green-700 border-green-200",
  scheduled: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ended: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_DOTS = {
  active: "bg-green-500",
  scheduled: "bg-yellow-400",
  ended: "bg-gray-400",
};

export default function AdminCampaignsTab({ campaigns: initialCampaigns, boundaries, org, userId }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showForm, setShowForm] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "scheduled" | "ended">("all");

  const filtered = campaigns.filter((c) => {
    if (filterTab === "all") return true;
    return campaignStatus(c) === filterTab;
  });

  const activeCampaigns = campaigns.filter((c) => campaignStatus(c) === "active");

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1E1E1E]">Campaigns</h2>
          <p className="text-sm text-[#6B6B6B]">Manage and track mobility improvement campaigns.</p>
        </div>
        <button
          onClick={() => { setEditCampaign(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E1E1E] text-white rounded-[12px] text-sm font-bold hover:bg-[#333] transition-all"
        >
          + New Campaign
        </button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <div className="mb-6">
          {boundaries.length === 0 ? (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-[16px] p-5">
              <p className="font-bold text-yellow-800 mb-1">No boundary set yet</p>
              <p className="text-sm text-yellow-700">
                Your campaign request will be submitted. The UrbanMaps team will assign a boundary and activate it.
              </p>
            </div>
          ) : null}
          <div className="mt-4">
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
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-2 border-[#1E1E1E] rounded-[16px] p-1 bg-white w-fit">
        {(["all", "active", "scheduled", "ended"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-4 py-1.5 rounded-[12px] text-sm font-medium capitalize transition-all ${
              filterTab === tab ? "bg-[#1E1E1E] text-white" : "text-[#6B6B6B] hover:bg-[#F6F0EA]"
            }`}
          >
            {tab === "all" ? "All Campaigns" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-12 text-center">
          <p className="text-[#9B9B9B] font-medium">No campaigns found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {filtered.map((c) => {
            const status = campaignStatus(c);
            const start = new Date(c.start_at);
            const end = new Date(c.end_at);
            const pinCount = (c as Campaign & { pin_count?: number }).pin_count ?? 0;

            return (
              <div
                key={c.id}
                className="bg-white border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card image area */}
                <div className="h-32 bg-[#F6F0EA] relative flex items-center justify-center">
                  <span className="text-4xl opacity-20">📍</span>
                  {/* Status badge */}
                  <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_STYLES[status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOTS[status]}`} />
                    {status.toUpperCase()}
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-[#1E1E1E] leading-tight">{c.title}</h3>
                  </div>
                  <p className="text-xs text-[#9B9B9B] mb-3">
                    {start.toLocaleDateString()} – {end.toLocaleDateString()}
                  </p>

                  {c.description && (
                    <p className="text-xs text-[#6B6B6B] mb-3 line-clamp-2">{c.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#6B6B6B] mb-3">
                    <span className="font-medium">{pinCount} Reports</span>
                    {status === "active" && (
                      <span className="font-bold text-[#1E1E1E]">{daysLeft(c.end_at)}d left</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditCampaign(c); setShowForm(true); }}
                      className="flex-1 px-3 py-1.5 border-2 border-[#1E1E1E] rounded-[10px] text-xs font-bold hover:bg-[#F6F0EA] transition-all"
                    >
                      Edit
                    </button>
                    <a
                      href={`/o/${org.slug}/c/${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-1.5 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[10px] text-xs font-bold text-[#1E1E1E] text-center hover:bg-[#0891B2] transition-all"
                    >
                      View Map
                    </a>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Create new card */}
          {!showForm && (
            <button
              onClick={() => { setEditCampaign(null); setShowForm(true); }}
              className="bg-white border-2 border-dashed border-[#9B9B9B] rounded-[16px] p-8 flex flex-col items-center justify-center gap-3 text-[#9B9B9B] hover:border-[#1E1E1E] hover:text-[#1E1E1E] transition-all min-h-[200px]"
            >
              <span className="text-3xl">+</span>
              <p className="font-bold text-sm">Create New Campaign</p>
              <p className="text-xs text-center">Initiate a new time-bound mobility project</p>
            </button>
          )}
        </div>
      )}

      {/* Overall stats */}
      <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-[#1E1E1E]">Overall Campaign Progress</h3>
            <p className="text-sm text-[#6B6B6B]">Aggregated across all campaigns</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-2xl font-bold text-[#1E1E1E]">{campaigns.length}</p>
            <p className="text-xs text-[#9B9B9B] uppercase font-bold tracking-wider">Total Campaigns</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1E1E1E]">{activeCampaigns.length}</p>
            <p className="text-xs text-[#9B9B9B] uppercase font-bold tracking-wider">Active Now</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1E1E1E]">{campaigns.filter(c => campaignStatus(c) === "ended").length}</p>
            <p className="text-xs text-[#9B9B9B] uppercase font-bold tracking-wider">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1E1E1E]">{campaigns.filter(c => campaignStatus(c) === "scheduled").length}</p>
            <p className="text-xs text-[#9B9B9B] uppercase font-bold tracking-wider">Scheduled</p>
          </div>
        </div>
      </div>
    </div>
  );
}
