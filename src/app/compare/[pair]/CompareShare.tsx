"use client";

import { useState } from "react";

/** Share button for a comparison page (Web Share API with clipboard fallback). */
export default function CompareShare({ aName, bName }: { aName: string; bName: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    const text = `${aName} vs ${bName} — compared on aiDexer`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="px-4 py-2 text-sm font-semibold border border-neutral-300 dark:border-neutral-700 rounded-full hover:border-neutral-500 transition-colors"
    >
      {copied ? "Link copied!" : "Share"}
    </button>
  );
}
