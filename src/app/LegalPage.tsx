import Link from "next/link";
import { ReactNode } from "react";
import SiteNav from "./SiteNav";

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen transition-colors">
      <SiteNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <li>
              <Link
                href="/"
                className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-neutral-900 dark:text-neutral-100 font-medium">
              {title}
            </li>
          </ol>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-50 mb-2">
          {title}
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 sm:mb-10">
          Last updated: {updated}
        </p>

        <div className="space-y-8 text-neutral-700 dark:text-neutral-300 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-neutral-900 [&_h2]:dark:text-neutral-100 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
          {children}
        </div>

        <div className="mt-12 pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2>{heading}</h2>
      {children}
    </section>
  );
}