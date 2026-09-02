import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "../../SiteNav";
import { parseCompareSlug, slugify } from "@/lib/tools";
import CompareShare from "./CompareShare";

export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pair: string }>;
}): Promise<Metadata> {
  const { pair } = await params;
  const result = parseCompareSlug(pair);
  if (!result) return { title: "Comparison not found — aiDexer" };
  const [a, b] = result;
  return {
    title: `${a.name} vs ${b.name} — AI tool comparison | aiDexer`,
    description: `${a.name} vs ${b.name}: pricing, strengths, access, and which one fits your workflow. Auto-generated from aiDexer's directory.`,
  };
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr_1fr] sm:grid-cols-[140px_1fr_1fr] gap-2 sm:gap-4 py-3 border-b border-neutral-200 dark:border-neutral-800 last:border-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 pt-0.5">
        {label}
      </div>
      <div className="text-sm">{a}</div>
      <div className="text-sm">{b}</div>
    </div>
  );
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ pair: string }>;
}) {
  const { pair } = await params;
  const result = parseCompareSlug(pair);
  if (!result) notFound();
  const [a, b] = result;

  return (
    <main className="min-h-screen">
      <SiteNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <header className="mb-6">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-2">
            {a.name} vs {b.name}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Two {a.category} tools, compared side by side from the aiDexer directory.
          </p>
        </header>

        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[110px_1fr_1fr] sm:grid-cols-[140px_1fr_1fr] gap-2 sm:gap-4 px-4 py-3 bg-neutral-100 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800">
            <div />
            <Link href={`/tools/${slugify(a.name)}`} className="text-sm sm:text-base font-bold hover:underline">
              {a.name}
            </Link>
            <Link href={`/tools/${slugify(b.name)}`} className="text-sm sm:text-base font-bold hover:underline">
              {b.name}
            </Link>
          </div>
          <div className="px-4 py-2">
            <Row label="Category" a={a.category} b={b.category} />
            <Row label="Pricing" a={a.pricing} b={b.pricing} />
            <Row label="Access" a={a.access} b={b.access} />
            <Row label="Strengths" a={a.strengths.join(", ")} b={b.strengths.join(", ")} />
            <Row label="Best for" a={a.bestFor.join(", ")} b={b.bestFor.join(", ")} />
            <Row label="Summary" a={a.description} b={b.description} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-full transition-colors"
          >
            Try {a.name} →
          </a>
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-full transition-colors"
          >
            Try {b.name} →
          </a>
          <CompareShare aName={a.name} bName={b.name} />
        </div>

        <p className="mt-10 text-sm">
          <Link href="/compare" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            ← All comparisons
          </Link>
        </p>
      </div>
    </main>
  );
}
