import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminRedirect() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1)
    .single();

  if (!membership) redirect("/");

  const { data: org } = await supabase
    .from("orgs")
    .select("slug")
    .eq("id", membership.org_id)
    .single();

  if (!org) redirect("/");

  redirect(`/o/${org.slug}/admin`);
}
