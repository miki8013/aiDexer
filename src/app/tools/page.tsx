import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "../SiteNav";
import { aiDatabase } from "../api/recommend/aiDatabase";
import { slugify, allCategories } from "@/lib/tools";

export const metadata: Metadata = {
  title: "All AI Tools — aiDexer",
  description: "Browse every AI tool in the aiDexer directory by category.",
};

export default function ToolsIndex() {
  const categories = allCategories();
  return (
    <main className="min-h-screen">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">All AI Tools</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            {aiDatabase.length} tools across {categories.length} categories — every entry has
            alternatives, comparisons, and community signals.
          </p>
        </header>
        {categories.map((cat) => (
          <section key={cat} className="mb-10">
            <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
              {cat}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {aiDatabase
                .filter((t) => t.category === cat)
                .map((t) => (
                  <li key={t.name}>
                    <Link
                      href={`/tools/${slugify(t.name)}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
                    >
                      <span className="font-medium text-sm">{t.name}</span>
                      <span className="text-xs text-neutral-400 truncate max-w-[45%]">{t.pricing}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
