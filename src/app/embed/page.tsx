import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "../SiteNav";

export const metadata: Metadata = {
  title: "Embeddable Compare Widget — aiDexer",
  description: "Add a free 'compare AI tools' widget to your blog or site — auto-generated comparison tables that link back to aiDexer.",
};

export default function EmbedDocsPage() {
  const exampleCode = `<iframe
  src="https://YOUR-DOMAIN/embed/compare?tools=chatgpt-openai,claude-anthropic"
  width="100%" height="480" style="border:0;border-radius:12px"
  loading="lazy" title="Compare AI tools — aiDexer">
</iframe>`;
  return (
    <main className="min-h-screen">
      <SiteNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Embed a compare widget</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Writing about AI tools? Drop a live, always-up-to-date comparison table into your post.
            It links back to aiDexer for the full data.
          </p>
        </header>

        <h2 className="text-lg font-bold tracking-tight mb-2">How to use it</h2>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300 mb-6">
          <li>
            Pick two (or three) tools and find their slugs on their detail pages, e.g.{" "}
            <Link href="/tools/chatgpt-openai" className="underline">/tools/chatgpt-openai</Link>.
          </li>
          <li>Build the embed URL: <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">/embed/compare?tools=&lt;slug-a&gt;,&lt;slug-b&gt;</code></li>
          <li>Drop it into an iframe on your site:</li>
        </ol>

        <pre className="bg-neutral-950 text-neutral-100 text-xs rounded-xl p-4 overflow-x-auto mb-6">
          <code>{exampleCode}</code>
        </pre>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          <a href="/embed/compare?tools=chatgpt-openai,claude-anthropic" className="underline">
            See a live example →
          </a>
        </p>

        <div className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
          Please keep the attribution link — it&apos;s the only ask. The widget is free for
          editorial use; reach out for anything commercial.
        </div>
      </div>
    </main>
  );
}
