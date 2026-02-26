import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import AdminDashboard from "./AdminDashboard";
import type { Boundary, Campaign, Pin, Comment } from "@/types";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AdminPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth/login?next=/o/${slug}/admin`);

  const { data: org } = await supabase
    .from("orgs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Check admin role
  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "admin") {
    redirect(`/o/${slug}`);
  }

  // Load all dashboard data
  const [
    { data: boundaries },
    { data: campaigns },
    { data: pins },
    { data: comments },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("boundaries")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("campaigns")
      .select("*, boundary:boundaries(name)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("pins")
      .select("*, profile:profiles(email)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("comments")
      .select("*, profile:profiles(email)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("org_memberships")
      .select("*, profile:profiles(email)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AdminDashboard
      org={{ id: org.id, name: org.name, slug: org.slug }}
      boundaries={(boundaries ?? []) as Boundary[]}
      campaigns={(campaigns ?? []) as Campaign[]}
      pins={(pins ?? []) as Pin[]}
      comments={(comments ?? []) as Comment[]}
      members={members ?? []}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  );
}
