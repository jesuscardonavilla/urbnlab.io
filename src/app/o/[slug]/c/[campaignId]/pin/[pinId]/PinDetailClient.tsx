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

  // Determine impact level based on votes
  const getImpactLevel = () => {
    if (voteCount >= 50) return "HIGH VOLUME";
    if (voteCount >= 20) return "MEDIUM VOLUME";
    return "LOW VOLUME";
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      {/* Back button header */}
      <div className="bg-white border-b-2 border-[#1E1E1E] px-6 py-4">
        <button
          onClick={() => router.push(`/o/${org.slug}/c/${campaignId}`)}
          className="flex items-center gap-2 text-[#1E1E1E] font-medium hover:text-[#6B6B6B]"
        >
          <span className="text-xl">←</span>
          <span>Back to map</span>
        </button>
      </div>

      {/* Photo with status badge */}
      {pin.photo_url && (
        <div className="relative w-full">
          <img
            src={pin.photo_url}
            alt={pin.title}
            className="w-full h-80 object-cover"
          />
          <div className="absolute top-4 right-4">
            <StatusBadge status={pin.status} />
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-[#1E1E1E] text-white text-xs font-bold uppercase rounded-full">
            {CATEGORY_LABELS[pin.category]}
          </span>
          {pin.impacted_groups.slice(0, 2).map((g) => (
            <span
              key={g}
              className="px-3 py-1 bg-[#1E1E1E] text-white text-xs font-bold uppercase rounded-full"
            >
              {IMPACTED_GROUP_LABELS[g]}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold mb-6" style={{ color: "#1E1E1E" }}>
          {pin.title}
        </h1>

        {/* Severity and Impact */}
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-6 mb-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-xs text-[#6B6B6B] uppercase tracking-wide font-bold mb-2 block">
                Severity
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className="text-2xl"
                    style={{ color: n <= pin.severity ? "#F59E0B" : "#E5E5E5" }}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-[#6B6B6B] uppercase tracking-wide font-bold mb-2 block">
                Impact
              </span>
              <p className="font-bold text-lg" style={{ color: "#1E1E1E" }}>
                {getImpactLevel()}
              </p>
            </div>
          </div>
        </div>

        {/* SECOND THIS ISSUE button */}
        <button
          onClick={handleVote}
          disabled={voteLoading}
          className={`w-full py-4 border-2 border-[#1E1E1E] rounded-[16px] font-bold text-lg transition-all mb-4 ${
            hasVoted
              ? "bg-[#059669] text-white"
              : "bg-[#06B6D4] text-[#1E1E1E] hover:bg-[#0891B2]"
          }`}
        >
          {hasVoted ? `✓ ISSUE SECONDED (${voteCount})` : `SECOND THIS ISSUE (${voteCount})`}
        </button>

        {error && (
          <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
        )}

        {/* COMMUNITY REPORT */}
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-6 mb-4">
          <h2 className="text-[#6B6B6B] font-bold text-sm uppercase tracking-wider mb-3">
            COMMUNITY REPORT
          </h2>
          <p className="text-[#1E1E1E] leading-relaxed mb-4">
            {pin.description}
          </p>

          {/* Metadata */}
          <div className="border-t-2 border-[#E5E5E5] pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B6B6B]">Timing Pattern</span>
              <span className="font-medium">{TIME_PATTERN_LABELS[pin.time_pattern]}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B6B6B]">Reported</span>
              <span className="font-medium">{new Date(pin.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B6B6B]">Location</span>
              <span className="font-medium text-xs">
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </span>
            </div>
          </div>
        </div>

        {/* COMMUNITY CONTEXT */}
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-6">
          <h2 className="text-[#6B6B6B] font-bold text-sm uppercase tracking-wider mb-4">
            COMMUNITY CONTEXT ({comments.length})
          </h2>

          {comments.length === 0 ? (
            <p className="text-[#6B6B6B] text-sm mb-6 text-center py-8">
              No comments yet. Be the first to add context!
            </p>
          ) : (
            <div className="space-y-4 mb-6">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  {/* Avatar placeholder */}
                  <div className="w-10 h-10 rounded-full bg-[#06B6D4] border-2 border-[#1E1E1E] flex items-center justify-center flex-shrink-0 font-bold text-white">
                    {c.profile?.email?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">
                        {c.profile?.email?.split("@")[0] ?? "Anonymous"}
                      </span>
                      <span className="text-xs text-[#6B6B6B]">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-[#1E1E1E] leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add context input */}
          {membership ? (
            <form onSubmit={handleComment} className="space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add more context..."
                rows={3}
                className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-4 py-3 text-sm outline-none focus:border-[#06B6D4] resize-none"
              />
              <button
                type="submit"
                disabled={commentLoading || !commentText.trim()}
                className="w-full py-3 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[12px] font-bold text-[#1E1E1E] hover:bg-[#0891B2] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {commentLoading ? "Posting..." : "POST CONTEXT"}
              </button>
            </form>
          ) : (
            <div className="text-sm text-center text-[#6B6B6B] py-4">
              <Link
                href={`/auth/login?next=/o/${org.slug}/c/${campaignId}/pin/${pin.id}`}
                className="text-[#06B6D4] hover:underline font-medium"
              >
                Sign in
              </Link>{" "}
              and join the community to add context.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
