"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { slugify } from "@/lib/tools";
import { useBookmarks } from "@/lib/hooks";

/**
 * Extras appended to every tool card on the homepage:
 *  - "I use this" community counter (social proof)
 *  - Bookmark toggle for the personal shortlist
 *  - Link to the tool's detail page (alternatives + comparisons)
 */
const voteCache = new Map<string, number>();

export default function ToolCardExtras({ toolName }: { toolName: string }) {
  const { bookmarks, toggle } = useBookmarks();
  const [count, setCount] = useState<number | null>(voteCache.get(toolName) ?? null);
  const [voted, setVoted] = useState(false);
  // Tracks the latest optimistic tap so stale server responses can't undo a
  // newer click (and lets rapid toggling work with zero perceived latency).
  const voteSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    try {
      setVoted(localStorage.getItem(`aidexer:voted:${toolName}`) === "1");
    } catch {}
    if (voteCache.has(toolName)) return;
    fetch(`/api/vote?tool=${encodeURIComponent(toolName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.count === "number") {
          voteCache.set(toolName, d.count);
          setCount(d.count);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [toolName]);

  const handleVote = async () => {
    // Optimistic UI (Instagram-style): flip instantly, reconcile in background.
    const nextVoted = !voted;
    setVoted(nextVoted);
    setCount((c) => (c === null ? c : Math.max(0, c + (nextVoted ? 1 : -1))));
    try {
      if (nextVoted) localStorage.setItem(`aidexer:voted:${toolName}`, "1");
      else localStorage.removeItem(`aidexer:voted:${toolName}`);
    } catch {}

    const mySeq = ++voteSeq.current;
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolName, action: nextVoted ? "use" : "unuse" }),
      });
      if (res.ok) {
        const d = await res.json();
        // Only apply the server's truth if the user hasn't tapped again since
        // this request was issued — otherwise a slow response could undo a
        // newer tap.
        if (voteSeq.current === mySeq) {
          voteCache.set(toolName, d.count);
          setCount(d.count);
          setVoted(!!d.voted);
          try {
            if (d.voted) localStorage.setItem(`aidexer:voted:${toolName}`, "1");
            else localStorage.removeItem(`aidexer:voted:${toolName}`);
          } catch {}
        }
      } else {
        // Request failed — revert the optimistic flip so the UI stays honest.
        if (voteSeq.current === mySeq) {
          setVoted(!nextVoted);
          setCount((c) => (c === null ? c : Math.max(0, c + (nextVoted ? -1 : 1))));
        }
      }
    } catch {
      if (voteSeq.current === mySeq) {
        setVoted(!nextVoted);
        setCount((c) => (c === null ? c : Math.max(0, c + (nextVoted ? -1 : 1))));
      }
    }
  };

  const bookmarked = bookmarks.includes(toolName);

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <button
        type="button"
        onClick={handleVote}
        aria-pressed={voted}
        aria-label={voted ? `Retract "I use ${toolName}"` : `I use ${toolName}`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          voted
            ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:border-emerald-600"
            : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-500"
        } disabled:opacity-60`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={voted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {voted ? "I use this ✓" : "I use this"}
        {count !== null && count > 0 && <span className="tabular-nums">· {count}</span>}
      </button>

      <button
        type="button"
        onClick={() => toggle(toolName)}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? `Remove ${toolName} from shortlist` : `Add ${toolName} to shortlist`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          bookmarked
            ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
            : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-500"
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {bookmarked ? "Saved" : "Save"}
      </button>

      <Link
        href={`/tools/${slugify(toolName)}`}
        className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
      >
        Details, alternatives & compare →
      </Link>
    </div>
  );
}
