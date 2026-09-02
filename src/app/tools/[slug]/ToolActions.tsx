"use client";

import { useEffect, useRef, useState } from "react";
import { useBookmarks } from "@/lib/hooks";

const FLAG_REASONS = ["Pricing changed", "Tool discontinued", "Wrong info", "Link broken"];

const voteCache = new Map<string, number>();

/**
 * Client-side actions on the tool detail page:
 *  - "I use this" vote — optimistic, reversible (identical to the homepage card)
 *  - Bookmark / shortlist toggle
 *  - "Flag outdated info" crowdsourced report form
 */
export default function ToolActions({ toolName }: { toolName: string }) {
  const { bookmarks, toggle } = useBookmarks();
  const [count, setCount] = useState<number | null>(voteCache.get(toolName) ?? null);
  const [voted, setVoted] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [reason, setReason] = useState(FLAG_REASONS[0]);
  const [note, setNote] = useState("");
  const [flagState, setFlagState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const seqRef = useRef(0);

  useEffect(() => {
    try {
      setVoted(localStorage.getItem(`aidexer:voted:${toolName}`) === "1");
    } catch {}
    fetch(`/api/vote?tool=${encodeURIComponent(toolName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.count === "number") {
          voteCache.set(toolName, d.count);
          setCount(d.count);
        }
      })
      .catch(() => {});
  }, [toolName]);

  // Optimistic, race-safe, reversible — same pattern as ToolCardExtras.
  const handleVote = () => {
    const seq = ++seqRef.current;
    const nextVoted = !voted;
    const delta = nextVoted ? 1 : -1;
    // 1. Flip the UI instantly.
    setVoted(nextVoted);
    setCount((c) => Math.max(0, (c ?? 0) + delta));
    try {
      if (nextVoted) localStorage.setItem(`aidexer:voted:${toolName}`, "1");
      else localStorage.removeItem(`aidexer:voted:${toolName}`);
    } catch {}
    // 2. Sync in the background; revert on failure or stale response.
    fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: toolName, action: nextVoted ? "use" : "unuse" }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (seqRef.current !== seq) return; // a newer tap already won
        voteCache.set(toolName, d.count);
        setCount(d.count);
        setVoted(!!d.voted);
      })
      .catch(() => {
        if (seqRef.current !== seq) return;
        setVoted(!nextVoted);
        setCount((c) => Math.max(0, (c ?? 0) - delta));
      });
  };

  const handleFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !window.confirm(
        `Submit this report for ${toolName}? Our team reviews flagged info before updating listings.`
      )
    ) {
      return;
    }
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
          aria-pressed={voted}
          aria-label={voted ? `Retract "I use ${toolName}"` : `I use ${toolName}`}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            voted
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:border-emerald-600"
              : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-500"
          }`}
        >
          &#9829; I use this{voted ? " \u2713" : ""}
          {count !== null && count > 0 ? ` \u00b7 ${count}` : ""}
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
          &#9733; {bookmarked ? "Saved to shortlist" : "Save to shortlist"}
        </button>

        <button
          type="button"
          onClick={() => setFlagOpen((o) => !o)}
          aria-expanded={flagOpen}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
          &#9873; Flag outdated info
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
