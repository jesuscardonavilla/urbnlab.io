import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          // Escape commas and quotes
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("org");
  const campaignId = searchParams.get("campaign") ?? undefined;
  const type = searchParams.get("type") ?? "pins";

  if (!orgId) {
    return NextResponse.json({ error: "org param required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  // Auth check — must be admin of org
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let csvData = "";
  let filename = `${type}.csv`;

  if (type === "campaigns") {
    let q = supabase
      .from("campaigns")
      .select("id, title, description, start_at, end_at, enabled_categories, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (campaignId) q = q.eq("id", campaignId);
    const { data } = await q;
    csvData = toCSV((data ?? []).map((r) => ({
      ...r,
      enabled_categories: (r.enabled_categories ?? []).join("|"),
    })));
    filename = "campaigns.csv";
  } else if (type === "pins") {
    let q = supabase
      .from("pins")
      .select("id, campaign_id, category, severity, time_pattern, impacted_groups, title, description, lat, lng, status, is_hidden, canonical_pin_id, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (campaignId) q = q.eq("campaign_id", campaignId);
    const { data } = await q;
    csvData = toCSV((data ?? []).map((r) => ({
      ...r,
      lat: r.lat ? parseFloat(r.lat.toFixed(3)) : "",
      lng: r.lng ? parseFloat(r.lng.toFixed(3)) : "",
      impacted_groups: (r.impacted_groups ?? []).join("|"),
    })));
    filename = "pins.csv";
  } else if (type === "votes") {
    // Aggregate counts per pin
    let q = supabase
      .from("votes")
      .select("pin_id, created_at")
      .eq("org_id", orgId);
    if (campaignId) {
      // Filter by pins in campaign
      const { data: pins } = await supabase
        .from("pins")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("org_id", orgId);
      const pinIds = (pins ?? []).map((p) => p.id);
      if (pinIds.length > 0) q = q.in("pin_id", pinIds);
    }
    const { data } = await q;
    // Count by pin
    const counts: Record<string, number> = {};
    (data ?? []).forEach((v) => {
      counts[v.pin_id] = (counts[v.pin_id] ?? 0) + 1;
    });
    csvData = toCSV(
      Object.entries(counts).map(([pin_id, count]) => ({ pin_id, vote_count: count }))
    );
    filename = "votes.csv";
  } else if (type === "comments") {
    let q = supabase
      .from("comments")
      .select("id, pin_id, body, is_hidden, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (campaignId) {
      const { data: pins } = await supabase
        .from("pins")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("org_id", orgId);
      const pinIds = (pins ?? []).map((p) => p.id);
      if (pinIds.length > 0) q = q.in("pin_id", pinIds);
    }
    const { data } = await q;
    csvData = toCSV(data ?? []);
    filename = "comments.csv";
  }

  return new NextResponse(csvData, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
