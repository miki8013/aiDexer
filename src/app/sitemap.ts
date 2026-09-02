import type { MetadataRoute } from "next";
import { aiDatabase } from "./api/recommend/aiDatabase";
import { slugify, featuredComparisons } from "@/lib/tools";

const BASE = "https://aidexer.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/tools", "/compare", "/digest", "/embed", "/privacy", "/terms"].map(
    (p) => ({ url: `${BASE}${p}`, lastModified: new Date() })
  );

  const toolPages = aiDatabase.map((t) => ({
    url: `${BASE}/tools/${slugify(t.name)}`,
    lastModified: new Date(),
  }));

  const comparePages = featuredComparisons().map(([a, b]) => ({
    url: `${BASE}/compare/${slugify(a.name)}-vs-${slugify(b.name)}`,
    lastModified: new Date(),
  }));

  return [...staticPages, ...toolPages, ...comparePages];
}
