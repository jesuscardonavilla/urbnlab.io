import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AddPinForm from "./AddPinForm";
import type { Campaign } from "@/types";

interface Props {
  params: Promise<{ slug: string; campaignId: string }>;
}

export default async function AddPinPage({ params }: Props) {
  const { slug, campaignId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/o/${slug}/c/${campaignId}/add`);
  }

  const { data: org } = await supabase
    .from("orgs")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Check membership
  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect(`/o/${slug}`);
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, boundary:boundaries(*)")
    .eq("id", campaignId)
    .eq("org_id", org.id)
    .single();

  if (!campaign) notFound();

  const now = new Date();
  const isActive =
    new Date(campaign.start_at) <= now && now <= new Date(campaign.end_at);

  if (!isActive) {
    redirect(`/o/${slug}/c/${campaignId}`);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      <Navbar />
      <AddPinForm
        campaign={campaign as Campaign}
        org={{ id: org.id, name: org.name, slug: org.slug }}
        userId={user.id}
      />
    </div>
  );
}
