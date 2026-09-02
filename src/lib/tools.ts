import { aiDatabase, type AIModel } from "../app/api/recommend/aiDatabase";

export type { AIModel };

/** URL-safe slug for a tool name, e.g. "ChatGPT (GPT-4)" -> "chatgpt-gpt-4". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getToolBySlug(slug: string): AIModel | undefined {
  const normalized = slug.toLowerCase();
  return aiDatabase.find((tool) => slugify(tool.name) === normalized);
}

/** Tools most similar to the given one (same category first, then keyword overlap). */
export function getAlternatives(tool: AIModel, limit = 6): AIModel[] {
  const overlap = (a: AIModel) => {
    const setB = new Set([...a.bestFor, ...a.strengths].map((s) => s.toLowerCase()));
    let shared = 0;
    for (const s of [...tool.bestFor, ...tool.strengths]) {
      if (setB.has(s.toLowerCase())) shared++;
    }
    return shared;
  };
  return aiDatabase
    .filter((t) => t.name !== tool.name)
    .map((t) => ({
      tool: t,
      score:
        (t.category === tool.category ? 10 : 0) +
        overlap(t) * 2,
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => e.tool);
}

/** Slug for a head-to-head comparison page, alphabetically ordered: "a-vs-b". */
export function compareSlug(a: string, b: string): string {
  const [x, y] = [slugify(a), slugify(b)].sort();
  return `${x}-vs-${y}`;
}

export function parseCompareSlug(pair: string): [AIModel, AIModel] | null {
  const parts = pair.split("-vs-");
  if (parts.length !== 2) return null;
  const a = getToolBySlug(parts[0]);
  const b = getToolBySlug(parts[1]);
  if (!a || !b || a.name === b.name) return null;
  return [a, b] as [AIModel, AIModel];
}

/** Curated comparison pairs for the /compare index: same-category rivals. */
export function featuredComparisons(): [AIModel, AIModel][] {
  const seen = new Set<string>();
  const pairs: [AIModel, AIModel][] = [];
  for (const tool of aiDatabase) {
    for (const alt of getAlternatives(tool, 3)) {
      if (alt.category !== tool.category) continue;
      const slug = compareSlug(tool.name, alt.name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      pairs.push([tool, alt]);
    }
  }
  return pairs;
}

export function allCategories(): string[] {
  return Array.from(new Set(aiDatabase.map((t) => t.category))).sort();
}
