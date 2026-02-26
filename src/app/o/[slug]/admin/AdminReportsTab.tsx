"use client";

import { useState } from "react";
import type { Pin, PinCategory, PinStatus } from "@/types";
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_LABELS } from "@/types";

interface AdminAction {
  id: string;
  action_type: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface Props {
  pins: Pin[];
  org: { id: string; name: string; slug: string };
  userId: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLORS: Record<PinStatus, string> = {
  new: "bg-red-100 text-red-600",
  reviewing: "bg-yellow-100 text-yellow-700",
  planned: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  closed_not_feasible: "bg-gray-100 text-gray-500",
};

export default function AdminReportsTab({ pins: initialPins, org, userId }: Props) {
  const [pins, setPins] = useState(initialPins);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showIgnored, setShowIgnored] = useState(false);

  // Detail panel state
  const [actionLoading, setActionLoading] = useState(false);
  const [assignText, setAssignText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [history, setHistory] = useState<AdminAction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  async function openPanel(pin: Pin) {
    setSelectedPin(pin);
    setAssignText("");
    setNoteText("");
    setNoteSaved(false);
    setHistoryLoading(true);

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("admin_actions")
      .select("*")
      .eq("target_id", pin.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data ?? []) as AdminAction[]);
    setHistoryLoading(false);
  }

  async function updateStatus(status: PinStatus) {
    if (!selectedPin) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("pins").update({ status }).eq("id", selectedPin.id);
    if (!error) {
      const updated = { ...selectedPin, status };
      setPins((prev) => prev.map((p) => p.id === selectedPin.id ? updated : p));
      setSelectedPin(updated);
      const { data: action } = await supabase.from("admin_actions").insert({
        org_id: org.id, actor_id: userId,
        action_type: "set_status", target_table: "pins",
        target_id: selectedPin.id, details: { status },
      }).select().single();
      if (action) setHistory((prev) => [action as AdminAction, ...prev]);
    }
    setActionLoading(false);
  }

  async function assignTo() {
    if (!selectedPin || !assignText.trim()) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { data: action } = await supabase.from("admin_actions").insert({
      org_id: org.id, actor_id: userId,
      action_type: "assign", target_table: "pins",
      target_id: selectedPin.id, details: { assigned_to: assignText.trim() },
    }).select().single();
    if (action) {
      setHistory((prev) => [action as AdminAction, ...prev]);
      setAssignText("");
    }
    setActionLoading(false);
  }

  async function addNote() {
    if (!selectedPin || !noteText.trim()) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { data: action } = await supabase.from("admin_actions").insert({
      org_id: org.id, actor_id: userId,
      action_type: "note", target_table: "pins",
      target_id: selectedPin.id, details: { note: noteText.trim() },
    }).select().single();
    if (action) {
      setHistory((prev) => [action as AdminAction, ...prev]);
      setNoteText("");
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }
    setActionLoading(false);
  }

  async function ignorePin(pin: Pin) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("pins").update({ is_hidden: true }).eq("id", pin.id);
    if (!error) {
      const updated = { ...pin, is_hidden: true };
      setPins((prev) => prev.map((p) => p.id === pin.id ? updated : p));
      if (selectedPin?.id === pin.id) setSelectedPin(updated);
      await supabase.from("admin_actions").insert({
        org_id: org.id, actor_id: userId,
        action_type: "hide_pin", target_table: "pins",
        target_id: pin.id, details: {},
      });
    }
    setActionLoading(false);
  }

  async function restorePin(pin: Pin) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    setActionLoading(true);
    const { error } = await supabase.from("pins").update({ is_hidden: false }).eq("id", pin.id);
    if (!error) {
      const updated = { ...pin, is_hidden: false };
      setPins((prev) => prev.map((p) => p.id === pin.id ? updated : p));
      if (selectedPin?.id === pin.id) setSelectedPin(updated);
    }
    setActionLoading(false);
  }

  // Filter
  const filtered = pins.filter((p) => {
    if (!showIgnored && p.is_hidden) return false;
    if (showIgnored && !p.is_hidden) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    return true;
  });

  function historyLabel(action: AdminAction): string {
    if (action.action_type === "set_status") {
      return `Status → ${STATUS_LABELS[action.details.status as PinStatus] ?? action.details.status}`;
    }
    if (action.action_type === "assign") return `Assigned to: ${action.details.assigned_to}`;
    if (action.action_type === "note") return `Note: "${action.details.note}"`;
    if (action.action_type === "hide_pin") return "Pin hidden";
    if (action.action_type === "unhide_pin") return "Pin restored";
    return action.action_type;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter bar */}
        <div className="px-6 py-3 bg-white border-b-2 border-[#1E1E1E] flex items-center gap-3 flex-shrink-0 flex-wrap">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#9B9B9B] uppercase tracking-wider">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-1.5 bg-white outline-none"
            >
              <option value="all">All Reports</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#9B9B9B] uppercase tracking-wider">Category:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-1.5 bg-white outline-none"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Ignore tray toggle */}
          <button
            onClick={() => { setShowIgnored(!showIgnored); setSelectedPin(null); }}
            className={`ml-auto text-xs font-bold px-3 py-1.5 rounded-[10px] border-2 transition-all ${
              showIgnored
                ? "bg-[#1E1E1E] text-white border-[#1E1E1E]"
                : "border-[#1E1E1E] text-[#6B6B6B] hover:bg-[#F6F0EA]"
            }`}
          >
            {showIgnored ? "← Back to Reports" : `Ignore Tray (${pins.filter(p => p.is_hidden).length})`}
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#9B9B9B]">
              <span className="text-4xl">📭</span>
              <p className="font-bold">{showIgnored ? "No ignored reports" : "No reports found"}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[#1E1E1E] bg-[#F6F0EA]">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#9B9B9B] w-14">Thumb</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#9B9B9B]">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#9B9B9B]">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#9B9B9B]">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#9B9B9B]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pin) => (
                  <tr
                    key={pin.id}
                    onClick={() => openPanel(pin)}
                    className={`border-b border-[#F0F0F0] cursor-pointer transition-colors ${
                      selectedPin?.id === pin.id ? "bg-[#F6F0EA]" : "hover:bg-[#FAFAFA]"
                    }`}
                  >
                    {/* Thumb */}
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-[8px] overflow-hidden border border-[#E5E5E5] flex-shrink-0">
                        {pin.photo_url ? (
                          <img src={pin.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full opacity-30" style={{ backgroundColor: CATEGORY_COLORS[pin.category] }} />
                        )}
                      </div>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded text-white whitespace-nowrap"
                        style={{ backgroundColor: CATEGORY_COLORS[pin.category] }}
                      >
                        {CATEGORY_LABELS[pin.category as PinCategory]?.toUpperCase()}
                      </span>
                    </td>
                    {/* Description */}
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#1E1E1E] truncate max-w-[200px]">{pin.title}</p>
                      {pin.description && (
                        <p className="text-[#9B9B9B] text-xs truncate max-w-[200px]">{pin.description}</p>
                      )}
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 text-[#9B9B9B] whitespace-nowrap text-xs">
                      {new Date(pin.created_at).toLocaleDateString()}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[pin.status]}`}>
                        {STATUS_LABELS[pin.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        <div className="px-6 py-2 border-t-2 border-[#1E1E1E] bg-white flex-shrink-0">
          <p className="text-xs text-[#9B9B9B]">Showing {filtered.length} of {pins.length} total reports</p>
        </div>
      </div>

      {/* Right: detail panel */}
      {selectedPin && (
        <div className="w-80 flex-shrink-0 bg-white border-l-2 border-[#1E1E1E] flex flex-col overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-4 border-b-2 border-[#1E1E1E] flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-bold text-[#9B9B9B]">#{selectedPin.id.slice(0, 8).toUpperCase()}</span>
            <button
              onClick={() => setSelectedPin(null)}
              className="text-[#6B6B6B] hover:text-[#1E1E1E] text-2xl leading-none"
            >×</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Photo */}
            {selectedPin.photo_url && (
              <img
                src={selectedPin.photo_url}
                alt={selectedPin.title}
                className="w-full h-36 object-cover border-b-2 border-[#1E1E1E]"
              />
            )}

            <div className="px-5 py-4 space-y-4">
              {/* Location */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-1">Location</p>
                <p className="text-sm font-bold text-[#1E1E1E]">{selectedPin.lat.toFixed(4)}, {selectedPin.lng.toFixed(4)}</p>
              </div>

              {/* Description */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-1">Citizen Description</p>
                <p className="text-sm text-[#1E1E1E] leading-relaxed">{selectedPin.description || "—"}</p>
              </div>

              {/* Status */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-2">Status</p>
                <select
                  value={selectedPin.status}
                  onChange={(e) => updateStatus(e.target.value as PinStatus)}
                  disabled={actionLoading}
                  className="w-full text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-2 bg-white outline-none"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Assign */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-2">Assign to Contractor</p>
                <div className="flex gap-2">
                  <input
                    value={assignText}
                    onChange={(e) => setAssignText(e.target.value)}
                    placeholder="Name or email..."
                    className="flex-1 text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-2 outline-none"
                    onKeyDown={(e) => e.key === "Enter" && assignTo()}
                  />
                  <button
                    onClick={assignTo}
                    disabled={!assignText.trim() || actionLoading}
                    className="px-3 py-2 bg-[#1E1E1E] text-white rounded-[10px] text-sm font-bold disabled:opacity-40"
                  >
                    Assign
                  </button>
                </div>
              </div>

              {/* History */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-2">History</p>
                {historyLoading ? (
                  <p className="text-xs text-[#9B9B9B]">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-[#9B9B9B]">No actions yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((a) => (
                      <div key={a.id} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#9B9B9B] mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-[#1E1E1E]">{historyLabel(a)}</p>
                          <p className="text-[10px] text-[#9B9B9B]">{timeAgo(a.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {noteSaved && (
                <p className="text-green-600 text-xs font-bold">✓ Note saved</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t-2 border-[#1E1E1E] space-y-2 flex-shrink-0">
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write an internal note..."
                className="w-full text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-2 outline-none resize-none"
                rows={2}
              />
              <button
                onClick={addNote}
                disabled={!noteText.trim() || actionLoading}
                className="w-full px-4 py-2.5 bg-[#1E1E1E] text-white rounded-[12px] text-sm font-bold hover:bg-[#333] transition-all disabled:opacity-40"
              >
                + Add Internal Note
              </button>
            </div>

            {selectedPin.is_hidden ? (
              <button
                onClick={() => restorePin(selectedPin)}
                disabled={actionLoading}
                className="w-full px-4 py-2.5 border-2 border-green-500 text-green-600 rounded-[12px] text-sm font-bold hover:bg-green-50 transition-all disabled:opacity-50"
              >
                Restore from Ignore Tray
              </button>
            ) : (
              <button
                onClick={() => ignorePin(selectedPin)}
                disabled={actionLoading}
                className="w-full px-4 py-2.5 border-2 border-[#9B9B9B] text-[#6B6B6B] rounded-[12px] text-sm font-bold hover:bg-[#F6F0EA] transition-all disabled:opacity-50"
              >
                Move to Ignore Tray
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
