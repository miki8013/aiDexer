import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "../SiteNav";
import { featuredComparisons, slugify } from "@/lib/tools";

export const metadata: Metadata = {
  title: "AI Tool Comparisons — aiDexer",
  description: "Head-to-head comparisons of popular AI tools: pricing, strengths, and best use cases.",
};

export default function CompareIndex() {
  const pairs = featuredComparisons();
  return (
    <main className="min-h-screen">
      <SiteNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Head-to-head comparisons</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Rival AI tools compared side by side — pricing, strengths, and who each one is really for.
            Auto-generated from the aiDexer directory, always in sync.
          </p>
        </header>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {pairs.map(([a, b]) => (
            <li key={slugify(a.name) + slugify(b.name)}>
              <Link
                href={`/compare/${slugify(a.name)}-vs-${slugify(b.name)}`}
                className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors text-sm font-medium"
              >
                <span>
                  {a.name} <span className="text-neutral-400 font-normal">vs</span> {b.name}
                </span>
                <span className="text-xs text-neutral-400">{a.category}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
