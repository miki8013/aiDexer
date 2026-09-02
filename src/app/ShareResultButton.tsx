"use client";

import { useState } from "react";

/**
 * Shareable result card: turns a personalized recommendation into a link
 * (/?q=...) that re-runs the search for whoever opens it.
 */
export default function ShareResultButton({ query, toolNames }: { query: string; toolNames: string[] }) {
  const [copied, setCopied] = useState(false);

  const shareText = `aiDexer recommended ${toolNames.slice(0, 3).join(", ")} for "${query}" — get your own picks:`;

  const handleShare = async () => {
    const url = `${window.location.origin}/?q=${encodeURIComponent(query)}`;
    const shareData = { title: "aiDexer picks", text: shareText, url };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareText} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-500 transition-colors"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
      {copied ? "Link copied!" : "Share result"}
    </button>
  );
}
