"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Map as LeafletMap } from "leaflet";
import type { Boundary, Campaign, Pin, Comment } from "@/types";
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_LABELS } from "@/types";

type NavTab = "overview" | "map" | "reports" | "campaigns" | "members";

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: { email: string };
}

interface Props {
  org: { id: string; name: string; slug: string };
  boundaries: Boundary[];
  campaigns: Campaign[];
  pins: Pin[];
  comments: Comment[];
  members: Member[];
  userId: string;
  userEmail: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all text-left ${
        active
          ? "bg-[#06B6D4] text-[#1E1E1E]"
          : "text-[#9B9B9B] hover:text-white hover:bg-[#2A2A2A]"
      }`}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-[16px] p-5">
      <p className="text-[#9B9B9B] text-xs font-bold uppercase tracking-wider mb-3">
        {label}
      </p>
      <p className="text-white text-3xl font-bold mb-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p className="text-xs font-medium" style={{ color: subColor ?? "#6B6B6B" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

interface OverviewTabProps {
  pins: Pin[];
  campaigns: Campaign[];
  activeCampaigns: Campaign[];
  openIssues: Pin[];
  resolved: Pin[];
  recentPins: Pin[];
  boundaries: Boundary[];
  org: { id: string; name: string; slug: string };
}

function OverviewTab({
  pins,
  activeCampaigns,
  openIssues,
  resolved,
  recentPins,
  boundaries,
}: OverviewTabProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const boundary = boundaries[0];
  const resolvedPct =
    pins.length > 0 ? Math.round((resolved.length / pins.length) * 100) : 0;

  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current) return;

      const map = L.map(mapContainerRef.current!, {
        center: [boundary?.center_lat ?? 39.5, boundary?.center_lng ?? -98.35],
        zoom: boundary?.default_zoom ?? 4,
        zoomControl: false,
        scrollWheelZoom: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      pins.forEach((pin) => {
        const color = CATEGORY_COLORS[pin.category] ?? "#6B6B6B";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:10px;height:10px;background:${color};border:2px solid #1E1E1E;border-radius:50%;cursor:pointer;"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      });

      if (boundary?.geog_json) {
        try {
          const geojson = JSON.parse(boundary.geog_json);
          const layer = L.geoJSON(geojson);
          map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 14 });
        } catch {}
      }

      mapRef.current = map;
    }

    init();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  return (
    <div className="p-6">
      <p className="text-sm text-[#6B6B6B] mb-6">
        Manage township mobility infrastructure, campaigns, and citizen feedback.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Reports"
          value={pins.length}
          sub="All time"
          subColor="#06B6D4"
        />
        <StatCard
          label="Open Issues"
          value={openIssues.length}
          sub="Needs attention"
          subColor="#F59E0B"
        />
        <StatCard
          label="Resolved"
          value={resolved.length}
          sub={`${resolvedPct}% resolution rate`}
          subColor="#10B981"
        />
        <StatCard
          label="Active Campaigns"
          value={activeCampaigns.length}
          sub="Live now"
          subColor="#06B6D4"
        />
      </div>

      {/* Map + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Live Map */}
        <div className="xl:col-span-3 bg-white border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden">
          <div className="px-4 py-3 border-b-2 border-[#1E1E1E] flex items-center gap-3">
            <span className="text-sm font-bold text-[#1E1E1E]">📍 Live Map View</span>
            <div className="flex items-center gap-4 ml-auto">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B6B6B]">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Critical
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B6B6B]">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Pending
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B6B6B]">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Fixed
              </span>
            </div>
          </div>
          <div ref={mapContainerRef} style={{ height: "360px" }} />
        </div>

        {/* Recent Activity */}
        <div className="xl:col-span-2 bg-white border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden">
          <div className="px-4 py-3 border-b-2 border-[#1E1E1E] flex items-center justify-between">
            <span className="text-sm font-bold text-[#1E1E1E]">Recent Activity</span>
            <button className="text-xs text-[#06B6D4] font-bold hover:underline">
              View All →
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "360px" }}>
            {recentPins.length === 0 ? (
              <div className="px-4 py-8 text-center text-[#9B9B9B] text-sm">
                No activity yet
              </div>
            ) : (
              recentPins.map((pin) => (
                <div
                  key={pin.id}
                  className="px-4 py-3 flex items-start gap-3 border-b border-[#F0F0F0] last:border-0"
                >
                  <div className="w-10 h-10 rounded-[8px] flex-shrink-0 overflow-hidden border border-[#E5E5E5]">
                    {pin.photo_url ? (
                      <img src={pin.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full opacity-30"
                        style={{ backgroundColor: CATEGORY_COLORS[pin.category] }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <p className="text-sm font-bold text-[#1E1E1E] truncate">{pin.title}</p>
                      <span className="text-[10px] text-[#9B9B9B] flex-shrink-0">
                        {timeAgo(pin.created_at)}
                      </span>
                    </div>
                    {pin.description && (
                      <p className="text-[11px] text-[#6B6B6B] truncate mb-1">
                        {pin.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: CATEGORY_COLORS[pin.category] }}
                      >
                        {CATEGORY_LABELS[pin.category]?.toUpperCase()}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          pin.status === "new"
                            ? "bg-red-100 text-red-600"
                            : pin.status === "reviewing"
                            ? "bg-yellow-100 text-yellow-700"
                            : pin.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {STATUS_LABELS[pin.status]?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard({
  org,
  boundaries,
  campaigns,
  pins,
  comments,
  members,
  userId,
  userEmail,
}: Props) {
  const [activeTab, setActiveTab] = useState<NavTab>("overview");

  const now = new Date();
  const activeCampaigns = campaigns.filter(
    (c) => new Date(c.start_at) <= now && now <= new Date(c.end_at)
  );
  const openIssues = pins.filter(
    (p) => p.status === "new" || p.status === "reviewing"
  );
  const resolved = pins.filter((p) => p.status === "completed");
  const recentPins = [...pins]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const TAB_TITLES: Record<NavTab, string> = {
    overview: "Admin Dashboard Overview",
    map: "Map View",
    reports: "Reports Management",
    campaigns: "Campaigns",
    members: "Members",
  };

  const navItems: { key: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      key: "overview",
      label: "Overview",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
          <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
          <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
          <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
          <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
        </svg>
      ),
    },
    {
      key: "map",
      label: "Map View",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    },
    {
      key: "reports",
      label: "Reports",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: "campaigns",
      label: "Campaigns",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      ),
    },
    {
      key: "members",
      label: "Members",
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#F6F0EA]">
      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 bg-[#1E1E1E] flex flex-col z-10">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[#2A2A2A]">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#06B6D4] rounded-[8px] flex items-center justify-center flex-shrink-0">
              <span className="text-[#1E1E1E] font-bold text-sm">U</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">UrbanMaps.io</p>
              <p className="text-[#6B6B6B] text-[10px]">Mobility Admin</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => (
            <NavItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.key}
              onClick={() => setActiveTab(item.key)}
            />
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 border-t border-[#2A2A2A] pt-4 space-y-1">
          <div className="px-4 py-2">
            <p className="text-[#6B6B6B] text-[10px] font-bold uppercase tracking-wider truncate">
              {org.name}
            </p>
            <p className="text-[#9B9B9B] text-xs truncate">{userEmail}</p>
          </div>
          <Link
            href={`/o/${org.slug}`}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm text-[#9B9B9B] hover:text-white hover:bg-[#2A2A2A] transition-all"
          >
            ← Back to site
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b-2 border-[#1E1E1E] px-6 h-14 flex items-center justify-between flex-shrink-0">
          <h1 className="font-bold text-[#1E1E1E]">{TAB_TITLES[activeTab]}</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#6B6B6B] hidden sm:block font-medium">
              {org.name}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#F6C8B8] border-2 border-[#1E1E1E] flex items-center justify-center">
              <span className="text-xs font-bold text-[#1E1E1E]">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "overview" && (
            <OverviewTab
              pins={pins}
              campaigns={campaigns}
              activeCampaigns={activeCampaigns}
              openIssues={openIssues}
              resolved={resolved}
              recentPins={recentPins}
              boundaries={boundaries}
              org={org}
            />
          )}

          {activeTab === "map" && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 bg-[#1E1E1E] rounded-[16px] flex items-center justify-center text-3xl">
                🗺️
              </div>
              <p className="text-xl font-bold text-[#1E1E1E]">Map View</p>
              <p className="text-[#6B6B6B] text-sm">
                Coming next — interactive admin map with pin moderation.
              </p>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 bg-[#1E1E1E] rounded-[16px] flex items-center justify-center text-3xl">
                📋
              </div>
              <p className="text-xl font-bold text-[#1E1E1E]">Reports Management</p>
              <p className="text-[#6B6B6B] text-sm">
                Coming next — full reports table with filters and assignment.
              </p>
            </div>
          )}

          {activeTab === "campaigns" && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 bg-[#1E1E1E] rounded-[16px] flex items-center justify-center text-3xl">
                📢
              </div>
              <p className="text-xl font-bold text-[#1E1E1E]">Campaigns</p>
              <p className="text-[#6B6B6B] text-sm">
                Coming next — campaign management and creation flow.
              </p>
            </div>
          )}

          {activeTab === "members" && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 bg-[#1E1E1E] rounded-[16px] flex items-center justify-center text-3xl">
                👥
              </div>
              <p className="text-xl font-bold text-[#1E1E1E]">Members</p>
              <p className="text-[#6B6B6B] text-sm">
                Coming next — member list and role management.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
