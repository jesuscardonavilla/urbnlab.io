import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import CampaignMapClient from "./CampaignMapClient";
import type { Campaign, Pin } from "@/types";

interface Props {
  params: Promise<{ slug: string; campaignId: string }>;
}

export default async function CampaignPage({ params }: Props) {
  const { slug, campaignId } = await params;
  const supabase = await createClient();

  // Load org
  const { data: org } = await supabase
    .from("orgs")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Load campaign + boundary
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, boundary:boundaries(*)")
    .eq("id", campaignId)
    .eq("org_id", org.id)
    .single();

  if (!campaign) notFound();

  // Load visible pins (not hidden, not merged duplicates)
  const { data: pins } = await supabase
    .from("pins")
    .select("*, vote_count:votes(count)")
    .eq("campaign_id", campaignId)
    .eq("is_hidden", false)
    .is("canonical_pin_id", null)
    .order("created_at", { ascending: false });

  // Get current user + membership
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

  // Attach vote counts
  const pinsWithCounts: Pin[] = (pins ?? []).map((p) => ({
    ...p,
    vote_count: Array.isArray(p.vote_count) ? p.vote_count[0]?.count ?? 0 : 0,
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <CampaignMapClient
        campaign={campaign as Campaign}
        pins={pinsWithCounts}
        org={{ id: org.id, name: org.name, slug: org.slug }}
        membership={membership}
        userId={user?.id ?? null}
      />
    </div>
  );
}
