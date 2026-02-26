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

const STATUS_COLORS: Record<PinStatus, string> = {
  new: "bg-red-100 text-red-600 border-red-200",
  reviewing: "bg-yellow-100 text-yellow-700 border-yellow-200",
  planned: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  closed_not_feasible: "bg-gray-100 text-gray-500 border-gray-200",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function historyLabel(action: AdminAction): string {
  if (action.action_type === "set_status") {
    return `Status changed to ${STATUS_LABELS[action.details.status as PinStatus] ?? action.details.status}`;
  }
  if (action.action_type === "assign") return `Assigned to ${action.details.assigned_to}`;
  if (action.action_type === "hide_pin") return "Report hidden from public";
  if (action.action_type === "unhide_pin") return "Report restored to public";
  if (action.action_type === "note") return "Internal note added";
  return action.action_type;
}

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

  // Panel mode: "view" | "status" | "assign" | "note"
  const [panelMode, setPanelMode] = useState<"view" | "status" | "assign" | "note">("view");

  // Track latest assignment per pin (keyed by pin id)
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  async function openPanel(pin: Pin) {
    setSelectedPin(pin);
    setPanelMode("view");
    setAssignText("");
    setNoteText("");
    setHistoryLoading(true);

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("admin_actions")
      .select("*")
      .eq("target_id", pin.id)
      .order("created_at", { ascending: false })
      .limit(30);

    const actions = (data ?? []) as AdminAction[];
    setHistory(actions);

    // Find latest assignment for this pin
    const latestAssign = actions.find((a) => a.action_type === "assign");
    if (latestAssign) {
      setAssignments((prev) => ({ ...prev, [pin.id]: latestAssign.details.assigned_to as string }));
    }

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
      setPanelMode("view");
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
      setAssignments((prev) => ({ ...prev, [selectedPin.id]: assignText.trim() }));
      setAssignText("");
      setPanelMode("view");
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
      setPanelMode("view");
    }
    setActionLoading(false);
  }

  async function ignorePin(pin: Pin) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
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
  }

  async function restorePin(pin: Pin) {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.from("pins").update({ is_hidden: false }).eq("id", pin.id);
    if (!error) {
      const updated = { ...pin, is_hidden: false };
      setPins((prev) => prev.map((p) => p.id === pin.id ? updated : p));
      if (selectedPin?.id === pin.id) setSelectedPin(updated);
    }
  }

  // Separate history into timeline events and internal notes
  const timelineEvents = history.filter((a) => a.action_type !== "note");
  const internalNotes = history.filter((a) => a.action_type === "note");

  // Filter
  const filtered = pins.filter((p) => {
    if (!showIgnored && p.is_hidden) return false;
    if (showIgnored && !p.is_hidden) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    return true;
  });

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Table ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Page header */}
        <div className="px-6 py-5 bg-white border-b-2 border-[#1E1E1E] flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#1E1E1E]">Reports Management</h2>
              <p className="text-sm text-[#6B6B6B] mt-0.5">Operational hub for urban issue triage and resolution.</p>
            </div>
            <button
              onClick={() => { setShowIgnored(!showIgnored); setSelectedPin(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-[12px] border-2 text-sm font-bold transition-all ${
                showIgnored
                  ? "bg-[#1E1E1E] text-white border-[#1E1E1E]"
                  : "border-[#1E1E1E] text-[#1E1E1E] hover:bg-[#F6F0EA]"
              }`}
            >
              {showIgnored ? "← Back to Reports" : `Ignore Tray (${pins.filter(p => p.is_hidden).length})`}
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-white border-b border-[#E5E5E5] flex items-center gap-3 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-2 border-2 border-[#E5E5E5] rounded-[10px] px-3 py-1.5">
            <span className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-wider">STATUS:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm bg-transparent outline-none font-medium text-[#1E1E1E] cursor-pointer"
            >
              <option value="all">All Reports</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 border-2 border-[#E5E5E5] rounded-[10px] px-3 py-1.5">
            <span className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-wider">CATEGORY:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-sm bg-transparent outline-none font-medium text-[#1E1E1E] cursor-pointer"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto bg-white">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-[#9B9B9B]">
              <span className="text-4xl">📭</span>
              <p className="font-bold">{showIgnored ? "Ignore tray is empty" : "No reports match your filters"}</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-12 px-6 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA] sticky top-0">
                <div className="col-span-1 text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B]">Thumb</div>
                <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B]">Category</div>
                <div className="col-span-3 text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B]">Description</div>
                <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B]">Location</div>
                <div className="col-span-1 text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B]">Date</div>
                <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B]">Assigned</div>
                <div className="col-span-1 text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B]">Status</div>
              </div>

              {/* Rows */}
              {filtered.map((pin) => (
                <div
                  key={pin.id}
                  onClick={() => openPanel(pin)}
                  className={`grid grid-cols-12 px-6 py-4 border-b border-[#F0F0F0] items-center cursor-pointer transition-colors ${
                    selectedPin?.id === pin.id ? "bg-[#F6F0EA]" : "hover:bg-[#FAFAFA]"
                  }`}
                >
                  {/* Thumb */}
                  <div className="col-span-1">
                    <div className="w-10 h-10 rounded-[8px] overflow-hidden border border-[#E5E5E5]">
                      {pin.photo_url ? (
                        <img src={pin.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full opacity-25" style={{ backgroundColor: CATEGORY_COLORS[pin.category] }} />
                      )}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="col-span-2">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded border text-white"
                      style={{ backgroundColor: CATEGORY_COLORS[pin.category as PinCategory] }}
                    >
                      {CATEGORY_LABELS[pin.category as PinCategory]?.toUpperCase().slice(0, 8)}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="col-span-3 pr-2">
                    <p className="font-bold text-sm text-[#1E1E1E] truncate">{pin.title}</p>
                    {pin.description && (
                      <p className="text-xs text-[#9B9B9B] truncate">{pin.description}</p>
                    )}
                  </div>

                  {/* Location */}
                  <div className="col-span-2">
                    <p className="text-xs text-[#6B6B6B] font-mono">
                      {pin.lat.toFixed(3)},<br />{pin.lng.toFixed(3)}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="col-span-1">
                    <p className="text-xs text-[#9B9B9B]">
                      {new Date(pin.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <p className="text-xs text-[#9B9B9B]">
                      {new Date(pin.created_at).getFullYear()}
                    </p>
                  </div>

                  {/* Assigned */}
                  <div className="col-span-2">
                    {assignments[pin.id] ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-[#06B6D4] border border-[#1E1E1E] flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-white">
                            {assignments[pin.id].charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-[#1E1E1E] truncate">{assignments[pin.id]}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#9B9B9B] italic">Unassigned</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_COLORS[pin.status]}`}>
                      {STATUS_LABELS[pin.status]?.split(" ")[0]}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer count */}
        <div className="px-6 py-2.5 border-t-2 border-[#1E1E1E] bg-white flex-shrink-0">
          <p className="text-xs text-[#9B9B9B]">
            Showing {filtered.length} of {pins.filter(p => showIgnored ? p.is_hidden : !p.is_hidden).length} reports
          </p>
        </div>
      </div>

      {/* ── Right: Detail Panel ── */}
      {selectedPin ? (
        <div className="w-80 flex-shrink-0 bg-white border-l-2 border-[#1E1E1E] flex flex-col overflow-hidden">

          {/* Panel header */}
          <div className="px-5 py-4 border-b-2 border-[#1E1E1E] flex items-center justify-between flex-shrink-0">
            <div>
              <p className="font-bold text-[#1E1E1E] text-sm">Report Details</p>
              <p className="text-[10px] text-[#9B9B9B] font-mono">#{selectedPin.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <button
              onClick={() => setSelectedPin(null)}
              className="text-[#9B9B9B] hover:text-[#1E1E1E] text-2xl leading-none"
            >×</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Photo */}
            <div className="border-b-2 border-[#E5E5E5]">
              {selectedPin.photo_url ? (
                <img
                  src={selectedPin.photo_url}
                  alt={selectedPin.title}
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="w-full h-32 flex items-center justify-center" style={{ backgroundColor: CATEGORY_COLORS[selectedPin.category] + "20" }}>
                  <div
                    className="w-12 h-12 rounded-full opacity-30"
                    style={{ backgroundColor: CATEGORY_COLORS[selectedPin.category] }}
                  />
                </div>
              )}
            </div>

            <div className="divide-y divide-[#F0F0F0]">
              {/* Location */}
              <div className="px-5 py-4 flex gap-3">
                <div className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#06B6D4]">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-1">Location</p>
                  <p className="text-sm font-bold text-[#1E1E1E] font-mono">
                    {selectedPin.lat.toFixed(5)}, {selectedPin.lng.toFixed(5)}
                  </p>
                  <a
                    href={`/o/${org.slug}/c/${selectedPin.campaign_id}/pin/${selectedPin.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#06B6D4] hover:underline font-medium mt-0.5 inline-block"
                  >
                    View on Interactive Map ↗
                  </a>
                </div>
              </div>

              {/* Citizen Description */}
              <div className="px-5 py-4 flex gap-3">
                <div className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#9B9B9B]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-1">Citizen Description</p>
                  <p className="text-sm font-bold text-[#1E1E1E] mb-1">{selectedPin.title}</p>
                  <p className="text-sm text-[#6B6B6B] leading-relaxed">{selectedPin.description || "No description provided."}</p>
                  {selectedPin.profile?.email && (
                    <p className="text-xs text-[#9B9B9B] mt-2">Reported by {selectedPin.profile.email}</p>
                  )}
                </div>
              </div>

              {/* History */}
              <div className="px-5 py-4 flex gap-3">
                <div className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#9B9B9B]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-2">History</p>
                  {historyLoading ? (
                    <p className="text-xs text-[#9B9B9B]">Loading…</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Always show "Report submitted" at bottom */}
                      {timelineEvents.map((a) => (
                        <div key={a.id} className="flex gap-2">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-[#06B6D4] mt-1 flex-shrink-0" />
                            <div className="w-px flex-1 bg-[#E5E5E5] mt-1" />
                          </div>
                          <div className="pb-2">
                            <p className="text-xs font-bold text-[#1E1E1E]">{historyLabel(a)}</p>
                            <p className="text-[10px] text-[#9B9B9B]">{formatDateTime(a.created_at)}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#9B9B9B] mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-[#1E1E1E]">Report submitted</p>
                          <p className="text-[10px] text-[#9B9B9B]">{formatDateTime(selectedPin.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Internal Activity (notes) */}
              {internalNotes.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9B9B9B] mb-3">Internal Activity</p>
                  <div className="space-y-2">
                    {internalNotes.map((n) => (
                      <div key={n.id} className="bg-[#F6F0EA] rounded-[10px] px-3 py-2.5">
                        <p className="text-xs text-[#1E1E1E] italic leading-relaxed">
                          &ldquo;{n.details.note as string}&rdquo;
                        </p>
                        <p className="text-[10px] text-[#9B9B9B] mt-1">{formatDateTime(n.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inline forms */}
              {panelMode === "status" && (
                <div className="px-5 py-4 bg-[#FAFAFA]">
                  <p className="text-xs font-bold text-[#1E1E1E] mb-2">Change Status</p>
                  <div className="space-y-1.5">
                    {(Object.entries(STATUS_LABELS) as [PinStatus, string][]).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => updateStatus(k)}
                        disabled={actionLoading || selectedPin.status === k}
                        className={`w-full text-left px-3 py-2 rounded-[10px] text-sm font-medium transition-all ${
                          selectedPin.status === k
                            ? "bg-[#1E1E1E] text-white"
                            : "hover:bg-[#F6F0EA] text-[#1E1E1E] border border-[#E5E5E5]"
                        } disabled:opacity-50`}
                      >
                        {v}
                      </button>
                    ))}
                    <button onClick={() => setPanelMode("view")} className="w-full text-xs text-[#9B9B9B] pt-1">Cancel</button>
                  </div>
                </div>
              )}

              {panelMode === "assign" && (
                <div className="px-5 py-4 bg-[#FAFAFA]">
                  <p className="text-xs font-bold text-[#1E1E1E] mb-2">Assign to Contractor</p>
                  <input
                    value={assignText}
                    onChange={(e) => setAssignText(e.target.value)}
                    placeholder="Name or email..."
                    className="w-full text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-2 outline-none mb-2"
                    onKeyDown={(e) => e.key === "Enter" && assignTo()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={assignTo}
                      disabled={!assignText.trim() || actionLoading}
                      className="flex-1 py-2 bg-[#1E1E1E] text-white rounded-[10px] text-sm font-bold disabled:opacity-40"
                    >
                      Assign
                    </button>
                    <button onClick={() => setPanelMode("view")} className="px-3 py-2 border-2 border-[#E5E5E5] rounded-[10px] text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {panelMode === "note" && (
                <div className="px-5 py-4 bg-[#FAFAFA]">
                  <p className="text-xs font-bold text-[#1E1E1E] mb-2">Add Internal Note</p>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Write an internal note visible only to admins..."
                    className="w-full text-sm border-2 border-[#1E1E1E] rounded-[10px] px-3 py-2 outline-none resize-none mb-2"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addNote}
                      disabled={!noteText.trim() || actionLoading}
                      className="flex-1 py-2 bg-[#1E1E1E] text-white rounded-[10px] text-sm font-bold disabled:opacity-40"
                    >
                      Save Note
                    </button>
                    <button onClick={() => setPanelMode("view")} className="px-3 py-2 border-2 border-[#E5E5E5] rounded-[10px] text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom action buttons */}
          {panelMode === "view" && (
            <div className="flex-shrink-0 border-t-2 border-[#1E1E1E]">
              {/* Status + Assign row */}
              <div className="grid grid-cols-2 border-b border-[#E5E5E5]">
                <button
                  onClick={() => setPanelMode("status")}
                  className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-[#1E1E1E] hover:bg-[#F6F0EA] transition-all border-r border-[#E5E5E5]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Status
                </button>
                <button
                  onClick={() => setPanelMode("assign")}
                  className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-[#1E1E1E] hover:bg-[#F6F0EA] transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Assign
                </button>
              </div>

              {/* Add Internal Note */}
              <button
                onClick={() => setPanelMode("note")}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1E1E1E] text-white font-bold text-sm hover:bg-[#333] transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                ADD INTERNAL NOTE
              </button>

              {/* Ignore/Restore */}
              {selectedPin.is_hidden ? (
                <button
                  onClick={() => restorePin(selectedPin)}
                  className="w-full py-2.5 text-xs font-bold text-green-600 hover:bg-green-50 transition-all border-t border-[#E5E5E5]"
                >
                  Restore from Ignore Tray
                </button>
              ) : (
                <button
                  onClick={() => ignorePin(selectedPin)}
                  className="w-full py-2.5 text-xs font-bold text-[#9B9B9B] hover:bg-[#F6F0EA] transition-all border-t border-[#E5E5E5]"
                >
                  Move to Ignore Tray
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div className="w-72 flex-shrink-0 bg-white border-l-2 border-[#1E1E1E] flex flex-col items-center justify-center text-center p-8 gap-3">
          <div className="w-12 h-12 bg-[#F6F0EA] rounded-full flex items-center justify-center text-2xl">📋</div>
          <p className="text-sm font-bold text-[#1E1E1E]">Select a report</p>
          <p className="text-xs text-[#9B9B9B]">Click any row to view report details, history, and take action.</p>
        </div>
      )}
    </div>
  );
}
