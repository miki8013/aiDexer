"use client";

import { useEffect, useState } from "react";
import { useBookmarks } from "@/lib/hooks";

const FLAG_REASONS = ["Pricing changed", "Tool discontinued", "Wrong info", "Link broken"];

/**
 * Client-side actions on the tool detail page:
 *  - "I use this" upvote counter (community social proof)
 *  - Bookmark / shortlist toggle
 *  - "Flag outdated info" crowdsourced report form
 */
export default function ToolActions({ toolName }: { toolName: string }) {
  const { bookmarks, toggle } = useBookmarks();
  const [count, setCount] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [reason, setReason] = useState(FLAG_REASONS[0]);
  const [note, setNote] = useState("");
  const [flagState, setFlagState] = useState<"idle" | "sending" | "done" | "error">("idle");

  useEffect(() => {
    try {
      setVoted(localStorage.getItem(`aidexer:voted:${toolName}`) === "1");
    } catch {}
    fetch(`/api/vote?tool=${encodeURIComponent(toolName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => typeof d?.count === "number" && setCount(d.count))
      .catch(() => {});
  }, [toolName]);

  const handleVote = async () => {
    if (voted) return;
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolName, action: "use" }),
      });
      if (res.ok) {
        const d = await res.json();
        setCount(d.count);
        setVoted(true);
        try {
          localStorage.setItem(`aidexer:voted:${toolName}`, "1");
        } catch {}
      }
    } catch {}
  };

  const handleFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlagState("sending");
    try {
      const res = await fetch("/api/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolName, reason, note }),
      });
      setFlagState(res.ok ? "done" : "error");
    } catch {
      setFlagState("error");
    }
  };

  const bookmarked = bookmarks.includes(toolName);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleVote}
          disabled={voted}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            voted
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
              : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-500"
          }`}
        >
          ♥ I use this{count !== null && count > 0 ? ` · ${count}` : ""}
        </button>

        <button
          type="button"
          onClick={() => toggle(toolName)}
          aria-pressed={bookmarked}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            bookmarked
              ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
              : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-500"
          }`}
        >
          ★ {bookmarked ? "Saved to shortlist" : "Save to shortlist"}
        </button>

        <button
          type="button"
          onClick={() => setFlagOpen((o) => !o)}
          aria-expanded={flagOpen}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
          ⚑ Flag outdated info
        </button>
      </div>

      {flagOpen && (
        <form onSubmit={handleFlag} className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">Something wrong with {toolName}? Tell us — crowd reports keep the directory honest.</p>
          <div className="flex flex-wrap gap-2">
            {FLAG_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  reason === r
                    ? "border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Optional details (e.g. new price is $25/mo)"
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={flagState === "sending" || flagState === "done"}
              className="px-4 py-2 text-sm font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-60"
            >
              {flagState === "sending" ? "Sending…" : flagState === "done" ? "Reported — thanks!" : "Submit report"}
            </button>
            {flagState === "error" && <span className="text-xs text-red-600">Failed to send — try again.</span>}
          </div>
        </form>
      )}
    </div>
  );
}
