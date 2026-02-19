"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import type { Pin, Comment } from "@/types";
import { CATEGORY_LABELS, CATEGORY_COLORS, TIME_PATTERN_LABELS, IMPACTED_GROUP_LABELS, STATUS_LABELS } from "@/types";

interface Props {
  pin: Pin;
  voteCount: number;
  comments: Comment[];
  org: { id: string; name: string; slug: string };
  campaignId: string;
  membership: { role: string } | null;
  userId: string | null;
  userHasVoted: boolean;
}

export default function PinDetailClient({
  pin,
  voteCount: initialVoteCount,
  comments: initialComments,
  org,
  campaignId,
  membership,
  userId,
  userHasVoted: initialHasVoted,
}: Props) {
  const router = useRouter();
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [hasVoted, setHasVoted] = useState(initialHasVoted);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleVote() {
    if (!userId) {
      router.push(`/auth/login?next=/o/${org.slug}/c/${campaignId}/pin/${pin.id}`);
      return;
    }
    if (!membership) {
      setError("Join the community to vote.");
      return;
    }

    setVoteLoading(true);
    const supabase = createClient();

    if (hasVoted) {
      const { error } = await supabase
        .from("votes")
        .delete()
        .eq("pin_id", pin.id)
        .eq("user_id", userId);
      if (!error) {
        setHasVoted(false);
        setVoteCount((v) => v - 1);
      }
    } else {
      const { error } = await supabase.from("votes").insert({
        org_id: org.id,
        pin_id: pin.id,
        user_id: userId,
      });
      if (!error) {
        setHasVoted(true);
        setVoteCount((v) => v + 1);
      } else {
        setError(error.message);
      }
    }
    setVoteLoading(false);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      router.push(`/auth/login?next=/o/${org.slug}/c/${campaignId}/pin/${pin.id}`);
      return;
    }
    if (!membership) {
      setError("Join the community to comment.");
      return;
    }
    if (!commentText.trim()) return;

    setCommentLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({
        org_id: org.id,
        pin_id: pin.id,
        user_id: userId,
        body: commentText.trim(),
      })
      .select("*, profile:profiles(email)")
      .single();

    if (error) {
      setError(error.message);
    } else {
      setComments((prev) => [...prev, data as Comment]);
      setCommentText("");
    }
    setCommentLoading(false);
  }

  const categoryColor = CATEGORY_COLORS[pin.category] ?? "#6B6B6B";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-[#6B6B6B] mb-4">
        <Link href={`/o/${org.slug}`} className="hover:underline">{org.name}</Link>
        <span>/</span>
        <Link href={`/o/${org.slug}/c/${campaignId}`} className="hover:underline">Map</Link>
        <span>/</span>
        <span className="text-[#1E1E1E] font-medium truncate">{pin.title}</span>
      </div>

      {/* Pin card */}
      <div className="bg-white border-2 border-[#1E1E1E] rounded-[22px] p-6 mb-4">
        {/* Category indicator */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: categoryColor }}
          />
          <span className="text-sm font-medium text-[#6B6B6B]">
            {CATEGORY_LABELS[pin.category]}
          </span>
          <StatusBadge status={pin.status} />
        </div>

        <h1 className="text-2xl font-bold mb-3">{pin.title}</h1>
        <p className="text-[#6B6B6B] mb-4">{pin.description}</p>

        {/* Photo */}
        {pin.photo_url && (
          <img
            src={pin.photo_url}
            alt="Pin photo"
            className="rounded-[12px] border-2 border-[#1E1E1E] max-h-60 object-cover mb-4 w-full"
          />
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <span className="text-xs text-[#6B6B6B] uppercase tracking-wide">Severity</span>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className={`w-5 h-5 rounded border-2 border-[#1E1E1E] ${
                    n <= pin.severity ? "bg-[#2DD4BF]" : "bg-white"
                  }`}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-[#6B6B6B] uppercase tracking-wide">Timing</span>
            <p className="mt-1 font-medium">{TIME_PATTERN_LABELS[pin.time_pattern]}</p>
          </div>
          {pin.impacted_groups.length > 0 && (
            <div className="col-span-2">
              <span className="text-xs text-[#6B6B6B] uppercase tracking-wide">Impacted groups</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {pin.impacted_groups.map((g) => (
                  <span
                    key={g}
                    className="text-xs px-2 py-0.5 bg-[#BFF3EC] rounded-full"
                  >
                    {IMPACTED_GROUP_LABELS[g]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Location */}
        <p className="text-xs text-[#6B6B6B] mb-4">
          📍 {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} ·{" "}
          Reported {new Date(pin.created_at).toLocaleDateString()}
        </p>

        {/* Vote */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleVote}
            disabled={voteLoading}
            className={`flex items-center gap-2 px-4 py-2 border-2 border-[#1E1E1E] rounded-[16px] font-medium transition-all text-sm ${
              hasVoted
                ? "bg-[#2DD4BF] text-[#1E1E1E]"
                : "bg-white text-[#1E1E1E] hover:bg-[#F6F0EA]"
            }`}
          >
            ▲ {hasVoted ? "Seconded" : "Second this"} · {voteCount}
          </button>
          <Link
            href={`/o/${org.slug}/c/${campaignId}`}
            className="text-sm text-[#6B6B6B] hover:underline"
          >
            ← Back to map
          </Link>
        </div>

        {error && (
          <p className="text-red-600 text-sm mt-3">{error}</p>
        )}
      </div>

      {/* Comments */}
      <div className="bg-white border-2 border-[#1E1E1E] rounded-[22px] p-6">
        <h2 className="font-bold text-lg mb-4">
          Discussion ({comments.length})
        </h2>

        {comments.length === 0 ? (
          <p className="text-[#6B6B6B] text-sm mb-4">No comments yet. Start the conversation!</p>
        ) : (
          <div className="space-y-3 mb-6">
            {comments.map((c) => (
              <div key={c.id} className="border-2 border-[#E5E5E5] rounded-[12px] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">
                    {c.profile?.email?.split("@")[0] ?? "Anonymous"}
                  </span>
                  <span className="text-xs text-[#6B6B6B]">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        {membership ? (
          <form onSubmit={handleComment} className="space-y-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
              className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF] resize-none"
            />
            <Button type="submit" disabled={commentLoading || !commentText.trim()}>
              {commentLoading ? "Posting…" : "Post comment"}
            </Button>
          </form>
        ) : (
          <div className="text-sm text-[#6B6B6B]">
            <Link href={`/auth/login?next=/o/${org.slug}/c/${campaignId}/pin/${pin.id}`} className="text-[#2DD4BF] hover:underline">
              Sign in
            </Link>{" "}
            and join the community to comment.
          </div>
        )}
      </div>
    </div>
  );
}
