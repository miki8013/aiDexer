import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "../SiteNav";
import { digestWeeks } from "@/lib/recentTools";
import { aiDatabase } from "../api/recommend/aiDatabase";
import { slugify } from "@/lib/tools";
import DigestSubscribe from "./DigestSubscribe";

export const metadata: Metadata = {
  title: "Weekly Digest — New AI Tools | aiDexer",
  description: "Every week, the newest AI tools added to the aiDexer directory — what they do, what they cost, and who they're for.",
};

export default function DigestPage() {
  const nameToTool = new Map(aiDatabase.map((t) => [t.name, t]));
  return (
    <main className="min-h-screen">
      <SiteNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">The weekly AI tools digest</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            A reason to come back every week: the newest additions to the aiDexer directory,
            one line each. Subscribe below and it lands in your inbox.
          </p>
        </header>

        {digestWeeks.map((week) => (
          <section key={week.weekOf} className="mb-8">
            <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
              {week.weekOf}
            </h2>
            <ul className="space-y-2">
              {week.tools.map((name) => {
                const tool = nameToTool.get(name);
                if (!tool) return null;
                return (
                  <li key={name} className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <Link href={`/tools/${slugify(name)}`} className="font-semibold hover:underline">
                        {tool.name}
                      </Link>
                      <span className="text-xs text-neutral-400">{tool.pricing}</span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{tool.description}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <DigestSubscribe />

        <p className="mt-10 text-sm">
          <Link href="/" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            ← Back to aiDexer
          </Link>
        </p>
      </div>
    </main>
  );
}
