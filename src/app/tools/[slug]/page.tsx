import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "../../SiteNav";
import { aiDatabase } from "../../api/recommend/aiDatabase";
import { slugify, getToolBySlug, getAlternatives, compareSlug } from "@/lib/tools";
import ToolActions from "./ToolActions";

export const dynamicParams = true;

export function generateStaticParams() {
  return aiDatabase.map((t) => ({ slug: slugify(t.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return { title: "Tool not found — aiDexer" };
  const alts = getAlternatives(tool, 3).map((t) => t.name).join(", ");
  return {
    title: `${tool.name} — review, pricing & alternatives | aiDexer`,
    description: `${tool.description} Alternatives: ${alts}. See pricing, strengths, and head-to-head comparisons on aiDexer.`,
  };
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  const alternatives = getAlternatives(tool, 6);

  return (
    <main className="min-h-screen">
      <SiteNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <header className="mb-6">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
            {tool.category}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">{tool.name}</h1>
          <p className="text-neutral-600 dark:text-neutral-400">{tool.description}</p>
        </header>

        <ToolActions toolName={tool.name} />

        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3">Pricing</h2>
            <p className="text-sm">{tool.pricing}</p>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mt-4 mb-2">Access</h2>
            <p className="text-sm">{tool.access}</p>
            <a
              href={tool.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block px-4 py-2 text-sm font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-full transition-colors"
            >
              Visit {tool.name} →
            </a>
          </div>
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3">Strengths</h2>
            <ul className="space-y-1.5">
              {tool.strengths.map((s) => (
                <li key={s} className="text-sm">✓ {s}</li>
              ))}
            </ul>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mt-4 mb-2">Best for</h2>
            <div className="flex flex-wrap gap-2">
              {tool.bestFor.map((b) => (
                <span key={b} className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* "Alternatives to X" — high-intent SEO content generated from the data */}
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight mb-4">
            Alternatives to {tool.name}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            Looking for something different? These {tool.category} tools cover similar ground:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {alternatives.map((alt) => (
              <li key={alt.name} className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors">
                <Link href={`/tools/${slugify(alt.name)}`} className="text-sm font-medium hover:underline">
                  {alt.name}
                </Link>
                <Link
                  href={`/compare/${compareSlug(tool.name, alt.name)}`}
                  className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 whitespace-nowrap"
                >
                  Compare →
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight mb-4">Head-to-head comparisons</h2>
          <div className="flex flex-wrap gap-2">
            {alternatives.slice(0, 4).map((alt) => (
              <Link
                key={alt.name}
                href={`/compare/${compareSlug(tool.name, alt.name)}`}
                className="text-sm px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-neutral-500 transition-colors"
              >
                {tool.name} vs {alt.name}
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-10 text-sm">
          <Link href="/tools" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            ← Browse all AI tools
          </Link>
        </p>
      </div>
    </main>
  );
}
