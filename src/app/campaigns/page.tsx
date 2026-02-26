"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type TabType = "active" | "upcoming" | "past";

interface CampaignRow {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  org: { name: string; slug: string } | null;
  boundary: { name: string } | null;
}

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)",
  "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
  "linear-gradient(135deg, #10B981 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #F97316 0%, #EF4444 100%)",
];

function daysLeft(endAt: string): number {
  return Math.max(0, Math.ceil((new Date(endAt).getTime() - Date.now()) / 86400000));
}

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("campaigns")
        .select("id, title, description, start_at, end_at, org:orgs(name, slug), boundary:boundaries(name)")
        .order("end_at", { ascending: false });
      setCampaigns((data as unknown as CampaignRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const now = new Date();

  const filtered = campaigns.filter((c) => {
    const start = new Date(c.start_at);
    const end = new Date(c.end_at);
    if (activeTab === "active") return start <= now && now <= end;
    if (activeTab === "upcoming") return now < start;
    if (activeTab === "past") return now > end;
    return false;
  });

  const counts = {
    active: campaigns.filter((c) => new Date(c.start_at) <= now && now <= new Date(c.end_at)).length,
    upcoming: campaigns.filter((c) => now < new Date(c.start_at)).length,
    past: campaigns.filter((c) => now > new Date(c.end_at)).length,
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-5xl font-bold mb-2" style={{ color: "#1E1E1E" }}>
          Campaigns
        </h1>
        <p className="text-[#6B6B6B] mb-8">Mobility improvement projects happening near you.</p>

        {/* Tabs */}
        <div className="flex gap-8 mb-8 border-b-2 border-[#1E1E1E]">
          {(["active", "upcoming", "past"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 font-bold text-sm tracking-wide uppercase transition-all flex items-center gap-2 ${
                activeTab === tab
                  ? "text-[#1E1E1E] border-b-4 border-[#1E1E1E] -mb-[2px]"
                  : "text-[#6B6B6B] hover:text-[#1E1E1E]"
              }`}
            >
              {tab}
              {counts[tab] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab ? "bg-[#1E1E1E] text-white" : "bg-[#E5E5E5] text-[#6B6B6B]"
                }`}>
                  {counts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Campaign Cards */}
        <div className="space-y-6">
          {loading ? (
            <div className="py-16 text-center text-[#6B6B6B]">Loading campaigns…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-12 text-center">
              <p className="text-[#6B6B6B]">No {activeTab} campaigns right now.</p>
            </div>
          ) : (
            filtered.map((campaign, i) => {
              const start = new Date(campaign.start_at);
              const end = new Date(campaign.end_at);
              const left = daysLeft(campaign.end_at);
              const orgSlug = campaign.org?.slug ?? "";
              const gradient = CARD_GRADIENTS[i % CARD_GRADIENTS.length];

              return (
                <div
                  key={campaign.id}
                  className="bg-[#1E1E1E] border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden"
                >
                  {/* Gradient image area */}
                  <div className="relative h-52" style={{ background: gradient }}>
                    {/* Grid overlay */}
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(255,255,255,0.5) 24px, rgba(255,255,255,0.5) 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(255,255,255,0.5) 24px, rgba(255,255,255,0.5) 25px)",
                      }}
                    />
                    {/* Big letter watermark */}
                    <div className="absolute bottom-3 left-5 text-white/20 text-8xl font-black leading-none select-none">
                      {campaign.title.charAt(0)}
                    </div>
                    {/* Status badge */}
                    <div className="absolute top-4 left-4">
                      {activeTab === "active" ? (
                        <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                          ● Active
                        </span>
                      ) : activeTab === "upcoming" ? (
                        <span className="bg-yellow-400 text-[#1E1E1E] text-xs font-bold px-3 py-1 rounded-full uppercase">
                          ◐ Upcoming
                        </span>
                      ) : (
                        <span className="bg-white/30 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                          ○ Ended
                        </span>
                      )}
                    </div>
                    {/* Days left */}
                    {activeTab === "active" && left > 0 && (
                      <div className="absolute top-4 right-4 bg-black/30 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                        ⏰ {left} DAYS LEFT
                      </div>
                    )}
                    {/* Org name */}
                    {campaign.org?.name && (
                      <div className="absolute bottom-4 right-4 bg-black/30 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                        {campaign.org.name}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="bg-white p-6">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h2 className="text-2xl font-bold" style={{ color: "#1E1E1E" }}>
                        {campaign.title}
                      </h2>
                    </div>

                    {campaign.description && (
                      <p className="text-[#1E1E1E] mb-3 leading-relaxed">
                        {campaign.description}
                      </p>
                    )}

                    <p className="text-[#9B9B9B] text-xs mb-5 font-medium">
                      {start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      {" – "}
                      {end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      {campaign.boundary?.name ? ` · ${campaign.boundary.name}` : ""}
                    </p>

                    <Link
                      href={`/o/${orgSlug}/c/${campaign.id}`}
                      className="block w-full text-center px-6 py-3 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[16px] font-bold text-[#1E1E1E] hover:bg-[#0891B2] hover:text-white transition-all"
                    >
                      VIEW MAP →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
