import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import PinDetailClient from "./PinDetailClient";
import type { Pin, Comment } from "@/types";

interface Props {
  params: Promise<{ slug: string; campaignId: string; pinId: string }>;
}

export default async function PinDetailPage({ params }: Props) {
  const { slug, campaignId, pinId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("orgs")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Load canonical pin
  const { data: pin } = await supabase
    .from("pins")
    .select("*, profile:profiles(email)")
    .eq("id", pinId)
    .eq("campaign_id", campaignId)
    .eq("is_hidden", false)
    .is("canonical_pin_id", null)
    .single();

  if (!pin) notFound();

  // Load merged duplicates
  const { data: duplicates } = await supabase
    .from("pins")
    .select("id")
    .eq("canonical_pin_id", pinId);

  const duplicateIds = [pinId, ...(duplicates ?? []).map((d) => d.id)];

  // Load votes (count across canonical + duplicates)
  const { count: voteCount } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true })
    .in("pin_id", duplicateIds);

  // Load comments (from canonical + duplicates, not hidden)
  const { data: comments } = await supabase
    .from("comments")
    .select("*, profile:profiles(email)")
    .in("pin_id", duplicateIds)
    .eq("is_hidden", false)
    .order("created_at", { ascending: true });

  // Current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let membership = null;
  let userHasVoted = false;

  if (user) {
    const { data: m } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle();
    membership = m;

    const { data: vote } = await supabase
      .from("votes")
      .select("id")
      .in("pin_id", duplicateIds)
      .eq("user_id", user.id)
      .maybeSingle();
    userHasVoted = !!vote;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      <Navbar />
      <PinDetailClient
        pin={pin as Pin}
        voteCount={voteCount ?? 0}
        comments={comments as Comment[]}
        org={{ id: org.id, name: org.name, slug: org.slug }}
        campaignId={campaignId}
        membership={membership}
        userId={user?.id ?? null}
        userHasVoted={userHasVoted}
      />
    </div>
  );
}
