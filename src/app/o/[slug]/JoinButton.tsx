"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";

interface Props {
  orgId: string;
  orgSlug: string;
  membership: { role: string } | null;
}

export default function JoinButton({ orgId, orgSlug, membership }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (membership) {
    return (
      <span className="text-sm px-3 py-1.5 bg-[#BFF3EC] border-2 border-[#2DD4BF] rounded-[16px] font-medium">
        {membership.role === "admin" ? "Admin" : "Member ✓"}
      </span>
    );
  }

  async function handleJoin() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/auth/login?next=/o/${orgSlug}`);
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("org_memberships").insert({
      org_id: orgId,
      user_id: user.id,
      role: "member",
    });

    if (!error) {
      router.refresh();
    } else if (error.code === "23505") {
      // Already a member
      router.refresh();
    } else {
      alert("Could not join: " + error.message);
    }
    setLoading(false);
  }

  return (
    <Button onClick={handleJoin} disabled={loading} variant="secondary">
      {loading ? "Joining…" : "Join community"}
    </Button>
  );
}
