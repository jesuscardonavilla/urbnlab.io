"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useState } from "react";

type TabType = "active" | "upcoming" | "past";

const campaigns = [
  {
    id: "c1000000-0000-0000-0000-000000000001",
    org: "traverse-city",
    city: "City of Traverse City",
    title: "Spring Mobility Fixes",
    description: "Help us identify mobility issues across Traverse City for our spring 2026 infrastructure plan.",
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&h=400&fit=crop",
    status: "active" as TabType,
    daysLeft: 45,
    supporters: 23,
  },
  {
    id: "c2000000-0000-0000-0000-000000000001",
    org: "monterrey",
    city: "Monterrey, Mexico",
    title: "Centro Urbano",
    description: "Identifica problemas de movilidad en Monterrey para mejorar la infraestructura del centro urbano.",
    image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=400&fit=crop",
    status: "active" as TabType,
    daysLeft: 52,
    supporters: 8,
  },
];

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("active");

  const filteredCampaigns = campaigns.filter((c) => c.status === activeTab);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-5xl font-bold mb-8" style={{ color: "#1E1E1E" }}>
          Campaigns
        </h1>

        {/* Tabs */}
        <div className="flex gap-8 mb-8 border-b-2 border-[#1E1E1E]">
          {(["active", "upcoming", "past"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 font-bold text-sm tracking-wide uppercase transition-all ${
                activeTab === tab
                  ? "text-[#1E1E1E] border-b-4 border-[#1E1E1E] -mb-[2px]"
                  : "text-[#6B6B6B]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Campaign Cards */}
        <div className="space-y-6">
          {filteredCampaigns.length === 0 ? (
            <p className="text-[#6B6B6B] text-center py-12">
              No {activeTab} campaigns
            </p>
          ) : (
            filteredCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-[#1E1E1E] border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden"
              >
                {/* Image */}
                <div className="relative">
                  <img
                    src={campaign.image}
                    alt={campaign.title}
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-[#059669] text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                      Active
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="bg-white p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-2xl font-bold mb-1" style={{ color: "#1E1E1E" }}>
                        {campaign.title}
                      </h2>
                      <p className="text-sm text-[#6B6B6B] font-medium">
                        {campaign.city}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-red-600 text-sm font-bold whitespace-nowrap">
                      <span className="text-lg">⏰</span>
                      {campaign.daysLeft} DAYS LEFT
                    </div>
                  </div>

                  <p className="text-[#1E1E1E] mb-2 leading-relaxed">
                    {campaign.description}
                  </p>

                  <p className="text-[#6B6B6B] text-sm mb-4">
                    Join {campaign.supporters} others in supporting this move.
                  </p>

                  <Link
                    href={`/o/${campaign.org}/c/${campaign.id}`}
                    className="block w-full text-center px-6 py-3 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[16px] font-bold text-[#1E1E1E] hover:bg-[#0891B2] transition-all"
                  >
                    VIEW MAP
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
