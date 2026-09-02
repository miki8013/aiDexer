import { NextRequest, NextResponse } from 'next/server';
import { aiDatabase, type AIModel } from './aiDatabase';
import { getAllTools } from '@/lib/toolsDb';
import { getUserSignals, type UserSignals } from '@/lib/serverStore';

// Security headers for all responses
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, limit: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  // Periodic cleanup so the map doesn't grow forever with unique IPs
  if (rateLimitMap.size > 1000) {
    for (const [ip, rec] of rateLimitMap) {
      if (now > rec.resetTime) rateLimitMap.delete(ip);
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

// Common stop words ignored when matching
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'to', 'of', 'in', 'on', 'with', 'and', 'or',
  'is', 'are', 'best', 'good', 'some', 'any', 'my', 'me', 'i', 'need',
  'want', 'help', 'tool', 'tools', 'ai', 'app', 'apps', 'that', 'can',
  'it', 'use', 'using', 'get', 'how', 'what', 'which', 'make', 'makes',
  'just', 'please', 'plz', 'something', 'thing', 'things', 'like', 'lol',
]);

// Small synonym map so everyday phrasing still hits the right keywords
const SYNONYMS: Record<string, string> = {
  translate: 'translation',
  translator: 'translation',
  translating: 'translation',
  picture: 'image',
  pictures: 'image',
  pic: 'image',
  pics: 'image',
  picsart: 'image',
  photo: 'image',
  photos: 'image',
  movie: 'video',
  movies: 'video',
  film: 'video',
  films: 'video',
  song: 'music',
  songs: 'music',
  singing: 'music vocals',
  singer: 'music vocals',
  resume: 'writing',
  resumes: 'writing',
  cv: 'writing',
  homework: 'education learning students',
  school: 'education',
  schools: 'education',
  college: 'education',
  university: 'education',
  studying: 'education learning students',
  study: 'education learning students',
  talking: 'voice conversation',
  speak: 'voice speech',
  speaking: 'voice speech',
  chatting: 'chat conversational',
  draw: 'art drawing',
  drawing: 'art',
  logo: 'logos design',
  logos: 'logos design',
  subtitle: 'subtitles captions',
  caption: 'captions subtitles',
  captions: 'captions subtitles',
  podcast: 'podcasting',
  podcasts: 'podcasting',
  meeting: 'meetings',
  youtube: 'video content creators',
  tiktok: 'social media video',
  instagram: 'social media',
  discord: 'voice',
  essay: 'writing',
  essays: 'writing',
  blog: 'writing blog',
  blogs: 'writing blog',
  code: 'coding',
  coding: 'coding programming',
  program: 'coding programming',
  programming: 'coding programming',
  debug: 'debugging',
  debugger: 'debugging',
  presentation: 'presentations',
  ppt: 'presentations',
  slides: 'presentations',
  slideshow: 'presentations',
  grammar: 'grammar writing',
  spell: 'grammar writing',
  summarize: 'summarization summaries',
  summary: 'summarization summaries',
  voiceover: 'voiceovers voice',
  voices: 'voice',
  dub: 'dubbing voice',
  dubbing: 'dubbing voice',
  clone: 'cloning',
  avatar: 'avatars',
  avatars: 'avatars',
  bg: 'background',
  background: 'background',
  money: 'business',
  customer: 'business',
  marketing: 'marketing',
  seo: 'seo marketing',
  website: 'web',
  sites: 'web',
  csv: 'data cleaning',
  csvs: 'data cleaning',
  spreadsheet: 'data',
  spreadsheets: 'data',
  excel: 'data',
  dataset: 'data',
  datasets: 'data',
  pandas: 'data python',
  messy: 'cleaning',
  clean: 'cleaning',
  cleaning: 'cleaning data',
  analyze: 'analysis',
  analyse: 'analysis',
  analytics: 'analysis',
  analyzing: 'analysis',
};

/**
 * Extract a numeric monthly price and whether a free/basic tier exists from a
 * human-friendly pricing string. `amount` is the entry-level paid tier in USD
 * per month, or null when it can't be pinned down (e.g. "Pay-per-use").
 */
function parseToolPrice(pricing: string): { amount: number | null; hasFree: boolean } {
  const lower = pricing.toLowerCase();
  const hasFree = /free|open[- ]?source|self-?hosted/i.test(lower);
  const amounts = [...pricing.matchAll(/\$(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
  let amount: number | null = null;
  if (amounts.length > 0) {
    // Take the smallest figure — that's the entry-level paid tier.
    amount = Math.min(...amounts);
    // Tame absurd ranges so the chart/filters stay sane.
    if (amount > 5000) amount = 5000;
  }
  return { amount, hasFree };
}

interface Constraints {
  budgetMax: number | null; // null = no upper cap
  freeOnly: boolean; // user only wants free tools
  noApi: boolean; // user wants local / offline / no API limits
}

/** Pull practical constraints (budget, free-only, offline) out of a free-form query. */
function parseConstraints(query: string): Constraints {
  const q = query.toLowerCase().replace(/[#$%,]/g, ' ').replace(/\s+/g, ' ').trim();
  const c: Constraints = { budgetMax: null, freeOnly: false, noApi: false };

  const capMatch = q.match(/(?:under|below|less than|at most|max(?:imum)?|budget(?: of)?|cheaper than)\s*(\d{1,4})/);
  if (capMatch) {
    const n = parseInt(capMatch[1], 10);
    if (n > 0 && n <= 5000) c.budgetMax = n;
  } else {
    const lt = q.match(/<\s*(\d{1,4})/);
    if (lt) {
      const n = parseInt(lt[1], 10);
      if (n > 0 && n <= 5000) c.budgetMax = n;
    }
  }

  if (/(?:only\s+)?free\b|no\s*(pay|cost|charge)|free[\s-]?tier/i.test(q) && !(c.budgetMax && c.budgetMax > 0)) {
    c.freeOnly = true;
  }

  c.noApi = /no\s*(api|server|cloud|connection)|without\s*(api|server|cloud)|offline|self-?hosted|open[- ]?source|local(ly)?|on\s+(my|your|our)\s+(machine|computer|device|pc)|no\s*(rate|usage|api)\s*limit|api\s*limit/i.test(q);

  return c;
}

/** True when a tool's pricing satisfies the user's budget/free constraints. */
function passesBudget(pricing: string, c: Constraints): boolean {
  const { amount, hasFree } = parseToolPrice(pricing);
  if (c.freeOnly) return hasFree;
  if (c.budgetMax !== null) return hasFree || (amount !== null && amount <= c.budgetMax);
  return true;
}

/** Human-readable summary of constraints, injected into the Gemini prompt. */
function constraintsSummary(c: Constraints): string | null {
  const parts: string[] = [];
  if (c.freeOnly) parts.push('only free tools, nothing paid');
  else if (c.budgetMax !== null) parts.push(`nothing more than $${c.budgetMax} per month`);
  if (c.noApi) parts.push('local, offline, open-source, or that do NOT hit API/rate limits');
  return parts.length > 0 ? parts.join('; ') : null;
}

function tokenize(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  // Expand with synonyms so everyday phrasing matches indexed keywords
  const expanded = new Set<string>(raw);
  for (const token of raw) {
    const synonyms = SYNONYMS[token];
    if (synonyms) {
      for (const synonym of synonyms.split(' ')) expanded.add(synonym);
    }
  }
  return Array.from(expanded);
}

// Cheap bounded Levenshtein distance for typo tolerance
function editDistanceWithin(a: string, b: string, maxDist: number): boolean {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return false; // early exit
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length] <= maxDist;
}

function typoDistance(token: string): number {
  if (token.length >= 6) return 2;
  if (token.length >= 4) return 1;
  return 0; // short tokens must match exactly
}

/** Match token as a whole word; also tolerates typos via edit distance. */
function matchesWord(token: string, text: string): boolean {
  // Whole-word regex match (fast path, exact)
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escaped}\\b`).test(text)) return true;
  // Typo tolerance: compare against the individual words in the text
  const dist = typoDistance(token);
  if (dist === 0) return false;
  const words = text.split(/\s+/);
  for (const word of words) {
    const cleaned = word.replace(/[^a-z0-9+#.-]/g, '');
    if (Math.abs(cleaned.length - token.length) > dist) continue;
    if (editDistanceWithin(token, cleaned, dist)) return true;
  }
  return false;
}

// Pre-split searchable text per tool so we don't rebuild it on every request
interface SearchEntry {
  tool: AIModel;
  name: string;
  category: string;
  strengths: string;
  bestFor: string;
  description: string;
}

/** Build a search index over a tool list (works for static or DB-loaded tools). */
function buildSearchIndex(tools: AIModel[]): SearchEntry[] {
  return tools.map((tool) => {
    const name = tool.name.toLowerCase();
    const category = tool.category.toLowerCase();
    const strengths = tool.strengths.join(' ').toLowerCase();
    const bestFor = tool.bestFor.join(' ').toLowerCase();
    const description = tool.description.toLowerCase();
    return {
      tool,
      name,
      category,
      strengths,
      bestFor,
      description,
    };
  });
}

/** Static fallback index (used when the DB is unavailable). */
const toolSearchIndex = buildSearchIndex(aiDatabase);

/**
 * Free, instant keyword-scoring recommendation engine.
 * Scores each tool by matching query tokens against its name,
 * category, strengths, bestFor and description. Handles typos
 * ("imgae" -> image). No external API calls, no API keys, no cost.
 */
function scoreTool(queryTokens: string[], category: string | null, entry: SearchEntry): number {
  let score = 0;

  for (const token of queryTokens) {
    // Exact name match is the strongest signal
    if (matchesWord(token, entry.name)) score += 10;
    // Category match
    if (matchesWord(token, entry.category)) score += 8;
    // bestFor / strengths match
    if (matchesWord(token, entry.bestFor)) score += 6;
    if (matchesWord(token, entry.strengths)) score += 5;
    // Description match (weakest)
    if (matchesWord(token, entry.description)) score += 2;
  }

  // Boost when user explicitly picked a category that matches the tool
  if (category && entry.category.includes(category.toLowerCase())) {
    score += 15;
  }

  // Small bonus for free-tier tools so free options surface first
  if (/free/i.test(entry.tool.pricing)) score += 1;

  return score;
}

/**
 * Personalization boost so recommendations adapt to the signed-in user:
 *  - tools they've bookmarked or voted for get a big lift,
 *  - tools in categories they already like get a lift,
 *  - tools matching keywords in their saved profile get a lift.
 */
function personalizationBoost(
  entry: SearchEntry,
  signals: UserSignals | null,
  likedCategories: Set<string>
): number {
  if (!signals) return 0;
  let boost = 0;
  const liked = new Set([...signals.bookmarks, ...signals.votes]);
  if (liked.has(entry.tool.name)) boost += 25;
  if (likedCategories.has(entry.category)) boost += 8;
  const profileLower = signals.profile.toLowerCase();
  if (profileLower) {
    for (const tok of tokenize(profileLower)) {
      if (matchesWord(tok, entry.name)) boost += 6;
      if (matchesWord(tok, entry.category)) boost += 4;
      if (matchesWord(tok, entry.bestFor)) boost += 3;
      if (matchesWord(tok, entry.strengths)) boost += 2;
    }
  }
  return boost;
}

// Gemini model candidates, tried in order (first available wins, cached)
const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-flash-latest'];
let geminiModelIndex = 0;

// Models reachable on the account, fetched live from Google's model list so
// we only ever try models the key can actually use. Cached for 10 minutes.
let availableModels: string[] | null = null;
let availableModelsFetchedAt = 0;
const AVAILABLE_MODELS_TTL = 10 * 60 * 1000;

async function getAvailableModels(apiKey: string): Promise<string[]> {
  if (availableModels && Date.now() - availableModelsFetchedAt < AVAILABLE_MODELS_TTL) {
    return availableModels;
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`model list HTTP ${res.status}`);
    const data = (await res.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    availableModels = (data.models ?? [])
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      .filter(
        (name) =>
          name.startsWith('gemini') &&
          !/tts|image|embedding|audio|omni|native/i.test(name) &&
          // text generation only
          name.length > 0
      );
    availableModelsFetchedAt = Date.now();
  } catch {
    // Can't fetch the list (network blip) — fall back to the static candidates
    availableModels = null;
  }
  return availableModels ?? GEMINI_MODELS;
}

// Circuit breaker: if Gemini keeps failing (dead key, outage, rate limits),
// skip it entirely for a cooldown period so the API stays fast.
let geminiFailures = 0;
let geminiDisabledUntil = 0;
// Last real reason Gemini failed (for surfacing in the UI when we fall back).
let lastGeminiError: string | null = null;
const GEMINI_MAX_FAILURES = 2;
const GEMINI_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Cache Gemini answers for repeated/identical queries to conserve tokens
const geminiCache = new Map<string, { tools: AIModel[]; expires: number }>();
const GEMINI_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const GEMINI_CACHE_MAX = 100;

function getCachedGemini(key: string): AIModel[] | null {
  const entry = geminiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    geminiCache.delete(key);
    return null;
  }
  return entry.tools;
}

function setCachedGemini(key: string, tools: AIModel[]): void {
  if (geminiCache.size >= GEMINI_CACHE_MAX) {
    const oldest = geminiCache.keys().next().value;
    if (oldest !== undefined) geminiCache.delete(oldest);
  }
  geminiCache.set(key, { tools, expires: Date.now() + GEMINI_CACHE_TTL });
}

/**
 * Ask Gemini (with Google Search grounding) to find real, current AI tools
 * matching the user's query — searching the live web rather than picking
 * from a fixed list. Returns normalized tool objects with live data.
 * Throws on failure so the caller can fall back to keyword scoring.
 */
async function getGeminiRecommendations(
  query: string,
  category: string | null,
  constraints: Constraints,
  profile: string | null = null
): Promise<AIModel[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  if (Date.now() < geminiDisabledUntil) {
    throw new Error('Gemini temporarily disabled (circuit breaker open)');
  }

  const constraintLine = constraintsSummary(constraints);
  const prompt = `
You are an AI tool researcher. Search the live web for the best AI tools that match this request, then return ONLY a JSON array (no code block, no extra text) of up to 8 tool objects:

User query: "${query}"
${category ? `Preferred category: ${category}` : ''}
${profile ? `User context (tailor picks accordingly): ${profile}` : ''}
${constraintLine ? `IMPORTANT requirements: ${constraintLine}` : ''}

Each object must have these exact fields:
- "name": the tool's product name
- "description": a 1-2 sentence summary of what it does
- "category": the most fitting category from: Image Generation, Video Generation, Audio/Music, Coding, Writing, Research & Chat, Productivity, Business, Education, Analytics, Developer Tools, Marketing, Design, or General Purpose
- "pricing": a string like "Free, $20/mo", "From $10/mo", "$249 one-time", "Custom", or "Unknown"
- "access": a short string like "Web app", "API", "Self-hosted", "Mobile app", "VS Code extension" — pick the primary access method
- "bestFor": a JSON array of 2-3 short strings (e.g. ["logo design", "social media", "print"]) describing what it's best for
- "strengths": a JSON array of 2-3 short strings describing key strengths/advantages

Base pricing and descriptions on what the tool currently offers as of your latest web search. If you can't find current pricing, use "Unknown".
`.trim();

  let lastError: unknown = null;

  const reachable = await getAvailableModels(apiKey);
  const candidates = [
    ...GEMINI_MODELS.filter((m) => reachable.includes(m)),
    ...reachable.filter((m) => !GEMINI_MODELS.includes(m)),
  ];
  const models = candidates.length > 0 ? candidates : GEMINI_MODELS;

  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = models[(geminiModelIndex + attempt) % models.length];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: prompt }] },
          ],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      });

      if (!res.ok) {
        lastError = new Error(`Gemini HTTP ${res.status} for ${model}`);
        continue;
      }

      geminiModelIndex = models.indexOf(model);
      geminiFailures = 0;

      const data = await res.json();
      const reply: string =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';

      const match = reply.match(/\[[\s\S]*\]/);
      if (!match) return [];

      let parsed: unknown[];
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return [];
      }

      const validTools: AIModel[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const t = item as Record<string, unknown>;
        const name = typeof t.name === 'string' ? t.name.trim() : '';
        if (!name) continue;

        validTools.push({
          name,
          description: typeof t.description === 'string' ? t.description.trim() : '',
          category: typeof t.category === 'string' ? t.category.trim() : 'General Purpose',
          pricing: typeof t.pricing === 'string' ? t.pricing.trim() : 'Unknown',
          access: typeof t.access === 'string' ? t.access.trim() : 'Web app',
          bestFor: Array.isArray(t.bestFor)
            ? t.bestFor.filter((x): x is string => typeof x === 'string').slice(0, 5)
            : [],
          strengths: Array.isArray(t.strengths)
            ? t.strengths.filter((x): x is string => typeof x === 'string').slice(0, 5)
            : [],
                              url: typeof t.url === 'string' ? t.url.trim() : '',
        });
      }

      setCachedGemini(geminiCacheKey(query, category, profile, constraints), validTools);
      return validTools.slice(0, 8);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('All Gemini models failed');
}

/** Extract a cache key for a Gemini web-search query. */
function geminiCacheKey(query: string, category: string | null, profile: string | null, constraints: Constraints): string {
  return `${query.toLowerCase()}|${category ?? ''}|${profile ?? ''}|${JSON.stringify(constraints)}`;
}

/** Record a Gemini failure and open the breaker after repeated failures. */
function noteGeminiFailure(): void {
  geminiFailures++;
  if (geminiFailures >= GEMINI_MAX_FAILURES) {
    geminiDisabledUntil = Date.now() + GEMINI_COOLDOWN_MS;
    geminiFailures = 0;
    console.error('Gemini disabled for 5 minutes after repeated failures');
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: securityHeaders }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.query !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400, headers: securityHeaders }
      );
    }

    const query = body.query.trim().slice(0, 500);
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 100) : null;
    const useAi = body.useAi === true;
    const profile = typeof body.profile === 'string' ? body.profile.trim().slice(0, 200) : null;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400, headers: securityHeaders }
      );
    }

    // Merge constraints parsed from the free-form query with an explicit UI budget
    // filter (e.g. a "Free only" / "Under $20" dropdown) into one effective set.
    const constraints = parseConstraints(query);
    const budgetField = typeof body.budget === 'string' ? body.budget.trim() : null;
    if (budgetField && budgetField !== 'any') {
      if (budgetField === 'free') {
        constraints.freeOnly = true;
        constraints.budgetMax = null;
      } else {
        const n = parseInt(budgetField, 10);
        if (Number.isInteger(n) && n > 0) {
          constraints.budgetMax = n;
          constraints.freeOnly = false;
        }
      }
    }

    // --- Tools: DB-first (single source of truth), fall back to static ---
    const tools = await getAllTools();
    const searchIndex = buildSearchIndex(tools);

    // --- User matching: pull the signed-in user's profile, bookmarks, votes ---
    let signals: UserSignals | null = null;
    try {
      const { auth } = await import('@/lib/auth');
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user?.id) signals = await getUserSignals(session.user.id);
    } catch {
      // Auth/DB not configured — no personalization, still works for guests.
    }
    const likedNames = new Set([...(signals?.bookmarks ?? []), ...(signals?.votes ?? [])]);
    const likedCategories = new Set(
      tools.filter((t) => likedNames.has(t.name)).map((t) => t.category.toLowerCase())
    );

    // --- AI mode: use Gemini with Google Search grounding for live web data ---
    if (useAi && process.env.GEMINI_API_KEY) {
      try {
        const liveTools = await getGeminiRecommendations(query, category, constraints, profile);
        if (liveTools.length > 0) {
          // Dedupe by name - Gemini occasionally repeats a tool
          const recommendations = liveTools
            .filter((tool, idx, arr) => arr.findIndex((t) => t.name === tool.name) === idx)
            .slice(0, 8);
          if (recommendations.length > 0) {
            return NextResponse.json(
              { recommendations, source: 'gemini' },
              { headers: securityHeaders }
            );
          }
        }
      } catch (error) {
        // Gemini failed (rate limit, outage, bad key) - fall through to the
        // free keyword engine so the user always gets results, but remember
        // the real reason so the UI can report exactly what went wrong.
        lastGeminiError = error instanceof Error ? error.message : String(error);
        console.error('Gemini failed, falling back to keyword engine:', error);
        noteGeminiFailure();
      }
    }

    const queryTokens = tokenize(query);

    // Score every tool and rank. Extra weight is added for tools that fit the
    // user's stated constraints (offline/open-source, free, within budget).
    // Anything that breaks the budget is dropped, so "unrelated expensive tools"
    // never get returned for a "free or under $X" request.
    const scored = searchIndex
      .map((entry) => {
        let score = scoreTool(queryTokens, category, entry);
        // Personalization: adapt to the signed-in user's profile/bookmarks/votes.
        score += personalizationBoost(entry, signals, likedCategories);
        if (constraints.noApi && /open[- ]?source|self-?hosted|local|desktop|privacy|offline/i.test(
          [entry.tool.pricing, entry.tool.access, entry.tool.strengths.join(' ')].join(' ')
        )) {
          score += 9;
        }
        const { hasFree } = parseToolPrice(entry.tool.pricing);
        if (constraints.freeOnly && hasFree) score += 5;
        if (constraints.budgetMax !== null && hasFree) score += 2;
        return { tool: entry.tool, score };
      })
      .filter((entry) => entry.score > 0 && passesBudget(entry.tool.pricing, constraints))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // If nothing keyword-matched but the user gave budget/offline constraints,
    // return constrained picks rather than unrelated general-purpose tools.
    let recommendations;
    if (scored.length > 0) {
      recommendations = scored.map((entry) => entry.tool);
    } else if (constraints.freeOnly || constraints.budgetMax !== null || constraints.noApi) {
      recommendations = tools
        .filter((tool) => passesBudget(tool.pricing, constraints))
        .sort((a, b) => Number(parseToolPrice(b.pricing).hasFree) - Number(parseToolPrice(a.pricing).hasFree))
        .slice(0, 8);
    } else {
      recommendations = tools.filter((tool) => tool.category === 'General Purpose').slice(0, 5);
    }

    return NextResponse.json(
      { recommendations, source: 'keyword', geminiError: lastGeminiError ?? undefined, hasGeminiKey: !!process.env.GEMINI_API_KEY },
      { headers: securityHeaders }
    );
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: securityHeaders }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: securityHeaders }
  );
}
