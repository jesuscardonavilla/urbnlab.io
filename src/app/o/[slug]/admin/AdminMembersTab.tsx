"use client";

import { useState } from "react";

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: { email: string };
}

interface Props {
  members: Member[];
  org: { id: string; name: string; slug: string };
  userId: string;
}

export default function AdminMembersTab({ members: initialMembers, org, userId }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function changeRole(member: Member, newRole: "admin" | "member") {
    setActionLoading(member.id);
    setError("");
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: e } = await supabase
      .from("org_memberships")
      .update({ role: newRole })
      .eq("id", member.id);
    if (e) {
      setError(e.message);
    } else {
      setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, role: newRole } : m));
    }
    setActionLoading(null);
  }

  async function removeMember(member: Member) {
    if (!confirm(`Remove ${member.profile?.email ?? "this member"} from ${org.name}?`)) return;
    setActionLoading(member.id);
    setError("");
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error: e } = await supabase
      .from("org_memberships")
      .delete()
      .eq("id", member.id);
    if (e) {
      setError(e.message);
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    }
    setActionLoading(null);
  }

  const admins = members.filter((m) => m.role === "admin");
  const regularMembers = members.filter((m) => m.role === "member");

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1E1E1E]">Members</h2>
          <p className="text-sm text-[#6B6B6B]">{members.length} member{members.length !== 1 ? "s" : ""} in {org.name}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-[#6B6B6B]">
            <span className="w-2 h-2 rounded-full bg-[#06B6D4]" />
            {admins.length} admin{admins.length !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5 text-[#6B6B6B]">
            <span className="w-2 h-2 rounded-full bg-[#9B9B9B]" />
            {regularMembers.length} member{regularMembers.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-[12px] px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {members.length === 0 ? (
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-12 text-center">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-bold text-[#1E1E1E] mb-1">No members yet</p>
          <p className="text-sm text-[#9B9B9B]">Members appear here once they join a campaign.</p>
        </div>
      ) : (
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 px-5 py-3 border-b-2 border-[#1E1E1E] bg-[#F6F0EA]">
            <div className="col-span-1" />
            <div className="col-span-5 text-xs font-bold uppercase tracking-wider text-[#9B9B9B]">Member</div>
            <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-[#9B9B9B]">Role</div>
            <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-[#9B9B9B]">Joined</div>
            <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-[#9B9B9B] text-right">Actions</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#F0F0F0]">
            {members.map((member) => {
              const isLoading = actionLoading === member.id;
              const isSelf = member.user_id === userId;
              const email = member.profile?.email ?? "Unknown";
              const initial = email.charAt(0).toUpperCase();

              return (
                <div
                  key={member.id}
                  className="grid grid-cols-12 px-5 py-4 items-center hover:bg-[#FAFAFA] transition-colors"
                >
                  {/* Avatar */}
                  <div className="col-span-1">
                    <div className="w-8 h-8 rounded-full bg-[#F6C8B8] border-2 border-[#1E1E1E] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#1E1E1E]">{initial}</span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="col-span-5">
                    <p className="text-sm font-medium text-[#1E1E1E] truncate">{email}</p>
                    {isSelf && <p className="text-[10px] text-[#9B9B9B]">You</p>}
                  </div>

                  {/* Role badge */}
                  <div className="col-span-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        member.role === "admin"
                          ? "bg-[#E0F9FF] text-[#06B6D4] border-[#06B6D4]"
                          : "bg-gray-100 text-gray-500 border-gray-300"
                      }`}
                    >
                      {member.role.toUpperCase()}
                    </span>
                  </div>

                  {/* Joined date */}
                  <div className="col-span-2">
                    <p className="text-xs text-[#9B9B9B]">
                      {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    {!isSelf && (
                      <>
                        <button
                          onClick={() => changeRole(member, member.role === "admin" ? "member" : "admin")}
                          disabled={isLoading}
                          className="text-xs px-2.5 py-1.5 border-2 border-[#1E1E1E] rounded-[8px] font-bold hover:bg-[#F6F0EA] transition-all disabled:opacity-40 whitespace-nowrap"
                        >
                          {isLoading ? "…" : member.role === "admin" ? "Make Member" : "Make Admin"}
                        </button>
                        <button
                          onClick={() => removeMember(member)}
                          disabled={isLoading}
                          className="text-xs px-2.5 py-1.5 border-2 border-red-400 text-red-500 rounded-[8px] font-bold hover:bg-red-50 transition-all disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
