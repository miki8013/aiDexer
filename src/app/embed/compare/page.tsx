import { getToolBySlug, type AIModel } from "@/lib/tools";
import CompareWidget from "./CompareWidget";

export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false },
};

/**
 * Framable compare widget for third-party sites.
 * Usage: /embed/compare?tools=slug-a,slug-b[,slug-c]
 * Framing is explicitly allowed via headers in next.config.js.
 */
export default async function EmbedComparePage({
  searchParams,
}: {
  searchParams: Promise<{ tools?: string }>;
}) {
  const { tools } = await searchParams;
  const slugs = (tools ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const picked = slugs
    .map((s) => getToolBySlug(s))
    .filter((t): t is AIModel => t !== undefined);

  return <CompareWidget tools={picked} />;
}
