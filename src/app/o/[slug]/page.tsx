import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import JoinButton from "./JoinButton";
import Link from "next/link";
import type { Campaign, Org } from "@/types";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function OrgPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  // Load org
  const { data: org } = await supabase
    .from("orgs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Load campaigns with boundary info
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, boundary:boundaries(name, center_lat, center_lng)")
    .eq("org_id", org.id)
    .order("end_at", { ascending: false });

  // Check if current user is a member
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let membership = null;
  if (user) {
    const { data } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle();
    membership = data;
  }

  const now = new Date();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Org header */}
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[22px] p-6 mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">{(org as Org).name}</h1>
            <p className="text-[#6B6B6B] text-sm">/{slug}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {membership?.role === "admin" && (
              <Link
                href={`/o/${slug}/admin`}
                className="text-sm px-4 py-2 bg-[#1E1E1E] text-white border-2 border-[#1E1E1E] rounded-[16px] hover:bg-[#333] transition-colors"
              >
                Admin dashboard
              </Link>
            )}
            <JoinButton
              orgId={(org as Org).id}
              orgSlug={slug}
              membership={membership}
            />
          </div>
        </div>

        {/* Campaigns */}
        <h2 className="text-xl font-bold mb-4">Campaigns</h2>

        {!campaigns || campaigns.length === 0 ? (
          <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-8 text-center text-[#6B6B6B]">
            No campaigns yet.
          </div>
        ) : (
          <div className="space-y-3">
            {(campaigns as (Campaign & { boundary?: { name: string } })[]).map((c) => {
              const start = new Date(c.start_at);
              const end = new Date(c.end_at);
              const isActive = start <= now && now <= end;

              return (
                <Link
                  key={c.id}
                  href={`/o/${slug}/c/${c.id}`}
                  className="block bg-white border-2 border-[#1E1E1E] rounded-[16px] p-5 hover:bg-[#F6F0EA] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold">{c.title}</h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                            isActive
                              ? "bg-[#BFF3EC] text-[#1E1E1E] border-[#2DD4BF]"
                              : "bg-gray-100 text-gray-500 border-gray-300"
                          }`}
                        >
                          {isActive ? "Active" : now > end ? "Ended" : "Upcoming"}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-sm text-[#6B6B6B] mb-2">{c.description}</p>
                      )}
                      <p className="text-xs text-[#6B6B6B]">
                        {start.toLocaleDateString()} – {end.toLocaleDateString()}
                        {c.boundary && ` · ${c.boundary.name}`}
                      </p>
                    </div>
                    <span className="text-[#6B6B6B] text-lg mt-0.5">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
