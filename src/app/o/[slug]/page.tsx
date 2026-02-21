"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import JoinButton from "./JoinButton";
import Link from "next/link";
import type { Campaign, Org } from "@/types";

interface Props {
  params: Promise<{ slug: string }>;
}

type TabType = "active" | "upcoming" | "past";

export default function OrgPage({ params }: Props) {
  const router = useRouter();
  const [slug, setSlug] = useState<string>("");
  const [org, setOrg] = useState<Org | null>(null);
  const [campaigns, setCampaigns] = useState<(Campaign & { boundary?: { name: string } })[]>([]);
  const [membership, setMembership] = useState<{ role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("active");

  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params;
      setSlug(resolvedParams.slug);

      const supabase = createClient();

      // Load org
      const { data: orgData } = await supabase
        .from("orgs")
        .select("*")
        .eq("slug", resolvedParams.slug)
        .single();

      if (!orgData) {
        router.push("/");
        return;
      }

      setOrg(orgData as Org);

      // Load campaigns with boundary info
      const { data: campaignsData } = await supabase
        .from("campaigns")
        .select("*, boundary:boundaries(name, center_lat, center_lng)")
        .eq("org_id", orgData.id)
        .order("end_at", { ascending: false });

      setCampaigns(campaignsData || []);

      // Check if current user is a member
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("org_memberships")
          .select("role")
          .eq("org_id", orgData.id)
          .eq("user_id", user.id)
          .maybeSingle();
        setMembership(data);
      }

      setLoading(false);
    }

    loadData();
  }, [params, router]);

  if (loading || !org) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-10 text-center">
          <p className="text-[#6B6B6B]">Loading...</p>
        </div>
      </div>
    );
  }

  const now = new Date();

  // Filter campaigns by tab
  const filteredCampaigns = campaigns.filter((c) => {
    const start = new Date(c.start_at);
    const end = new Date(c.end_at);
    const isActive = start <= now && now <= end;
    const isPast = now > end;
    const isUpcoming = now < start;

    if (activeTab === "active") return isActive;
    if (activeTab === "past") return isPast;
    if (activeTab === "upcoming") return isUpcoming;
    return false;
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Org header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-5xl font-bold mb-2" style={{ color: "#1E1E1E" }}>
                {org.name}
              </h1>
              <p className="text-[#6B6B6B] text-sm">/{slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {membership?.role === "admin" && (
              <Link
                href={`/o/${slug}/admin`}
                className="text-sm px-4 py-2 bg-[#1E1E1E] text-white border-2 border-[#1E1E1E] rounded-[16px] hover:bg-[#333] transition-colors font-bold"
              >
                ADMIN DASHBOARD
              </Link>
            )}
            <JoinButton
              orgId={org.id}
              orgSlug={slug}
              membership={membership}
            />
          </div>
        </div>

        {/* Campaigns Section */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold mb-6" style={{ color: "#1E1E1E" }}>
            Campaigns
          </h2>

          {/* Tabs */}
          <div className="flex gap-8 mb-8 border-b-2 border-[#1E1E1E]">
            {(["active", "upcoming", "past"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 font-bold text-sm tracking-wide uppercase transition-all ${
                  activeTab === tab
                    ? "text-[#1E1E1E] border-b-4 border-[#1E1E1E] -mb-[2px]"
                    : "text-[#6B6B6B] hover:text-[#1E1E1E]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Campaign Cards */}
          <div className="space-y-6">
            {filteredCampaigns.length === 0 ? (
              <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-12 text-center">
                <p className="text-[#6B6B6B]">No {activeTab} campaigns</p>
              </div>
            ) : (
              filteredCampaigns.map((c) => {
                const start = new Date(c.start_at);
                const end = new Date(c.end_at);
                const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <Link
                    key={c.id}
                    href={`/o/${slug}/c/${c.id}`}
                    className="block bg-white border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-bold" style={{ color: "#1E1E1E" }}>
                            {c.title}
                          </h3>
                          {activeTab === "active" && (
                            <span className="bg-[#059669] text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        {activeTab === "active" && daysLeft > 0 && (
                          <div className="flex items-center gap-1 text-red-600 text-sm font-bold whitespace-nowrap">
                            <span className="text-lg">⏰</span>
                            {daysLeft} DAYS LEFT
                          </div>
                        )}
                      </div>

                      {c.description && (
                        <p className="text-[#1E1E1E] mb-4 leading-relaxed">
                          {c.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-[#6B6B6B]">
                          {start.toLocaleDateString()} – {end.toLocaleDateString()}
                          {c.boundary && <span className="mx-2">·</span>}
                          {c.boundary?.name}
                        </p>
                        <span className="text-[#06B6D4] font-bold">VIEW MAP →</span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
