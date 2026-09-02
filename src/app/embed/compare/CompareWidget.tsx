"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { slugify, type AIModel } from "@/lib/tools";
import { useBookmarks } from "@/lib/hooks";

/** Minimal, self-contained comparison table used inside the embeddable iframe. */
export default function CompareWidget({ tools }: { tools: AIModel[] }) {
  const { bookmarks, toggle } = useBookmarks();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // The full site lives on the embedder's origin only when same-origin;
    // attribution should always point at the canonical home page.
    setOrigin("https://aidexer.com");
  }, []);

  if (tools.length < 2) {
    return (
      <div className="p-6 text-sm text-neutral-500">
        Add ?tools=slug-a,slug-b to compare tools.{" "}
        <a href={`${origin}/embed`} className="underline">Docs</a>
      </div>
    );
  }

  return (
    <div className="p-4 font-sans text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 w-24" />
              {tools.map((t) => (
                <th key={t.name} className="text-left p-2 align-bottom">
                  <a
                    href={`${origin}/tools/${slugify(t.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold hover:underline"
                  >
                    {t.name}
                  </a>
                  <div className="font-normal text-xs text-neutral-500 mt-0.5">{t.category}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-neutral-200 dark:border-neutral-800">
              <td className="p-2 text-xs font-semibold uppercase text-neutral-500">Pricing</td>
              {tools.map((t) => (
                <td key={t.name} className="p-2">{t.pricing}</td>
              ))}
            </tr>
            <tr className="border-t border-neutral-200 dark:border-neutral-800">
              <td className="p-2 text-xs font-semibold uppercase text-neutral-500">Access</td>
              {tools.map((t) => (
                <td key={t.name} className="p-2">{t.access}</td>
              ))}
            </tr>
            <tr className="border-t border-neutral-200 dark:border-neutral-800">
              <td className="p-2 text-xs font-semibold uppercase text-neutral-500">Best for</td>
              {tools.map((t) => (
                <td key={t.name} className="p-2">{t.bestFor.join(", ")}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tools.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => toggle(t.name)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              bookmarks.includes(t.name)
                ? "border-amber-500 text-amber-600"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            ★ {bookmarks.includes(t.name) ? "Saved" : "Save"}
          </button>
        ))}
        <a
          href={`${origin}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-neutral-400 hover:text-neutral-600"
        >
          Powered by <strong>aiDexer</strong> →
        </a>
      </div>
    </div>
  );
}
