"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import GridCanvas from "./GridCanvas";
import SiteNav from "./SiteNav";
import { useProfile } from "@/lib/hooks";
import { aiDatabase, type AIModel } from "@/app/api/recommend/aiDatabase";

// Maximum length of the user's search query. Kept aligned with the server-side
// limit in api/recommend/route.ts so we never send a huge blob of text.
const MAX_QUERY_LENGTH = 500;



function getSuggestions(category: string): AIModel[] {
  if (category !== "All") {
    return aiDatabase.filter(ai => ai.category === category);
  }
  return aiDatabase; // Show all tools as candidates; displayCount controls how many are visible
}

/** Parse a numeric monthly entry price + whether a free tier exists (client mirror of the API helper). */
function parseToolPrice(pricing: string): { amount: number | null; hasFree: boolean } {
  const lower = pricing.toLowerCase();
  const hasFree = /free|open[- ]?source|self-?hosted/i.test(lower);
  const amounts = [...pricing.matchAll(/\$(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
  let amount: number | null = null;
  if (amounts.length > 0) amount = Math.min(...amounts);
  return { amount, hasFree };
}

/** True when a tool fits the selected budget (any / free-only / under $N). */
function toolPassesBudget(pricing: string, budget: string): boolean {
  if (budget === 'any') return true;
  const { amount, hasFree } = parseToolPrice(pricing);
  if (budget === 'free') return hasFree;
  const max = parseInt(budget, 10);
  return hasFree || (amount !== null && amount <= max);
}

const BUDGET_OPTIONS = [
  { value: 'any', label: 'Any price' },
  { value: 'free', label: 'Free only' },
  { value: '10', label: 'Under $10' },
  { value: '20', label: 'Under $20' },
  { value: '50', label: 'Under $50' },
];

/** Inline horizontal bar chart comparing the monthly entry price of the given tools. */
function PriceChart({ tools }: { tools: AIModel[] }) {
  const data = tools
    .map((t) => ({ name: t.name, ...parseToolPrice(t.pricing) }))
    .sort((a, b) => {
      const av = a.hasFree ? 0 : a.amount ?? Number.MAX_SAFE_INTEGER;
      const bv = b.hasFree ? 0 : b.amount ?? Number.MAX_SAFE_INTEGER;
      return av - bv;
    });
  if (data.length === 0) return null;
  const maxPaid = Math.max(1, ...data.map((d) => d.amount ?? 0));

  return (
    <div className="mb-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide mb-4">
        Monthly price comparison
      </h3>
      <div className="space-y-2.5">
        {data.map((d) => {
          const isFree = d.hasFree;
          const pct = isFree ? 100 : d.amount == null ? 4 : Math.max(6, (d.amount / Math.max(maxPaid, 1)) * 100);
          const barClass = isFree
            ? 'bg-emerald-500'
            : d.amount == null
            ? 'bg-neutral-300 dark:bg-neutral-600'
            : 'bg-neutral-900 dark:bg-white dark:text-neutral-900';
          return (
            <div key={d.name} className="flex items-center gap-3">
              <div className="w-28 sm:w-44 shrink-0 truncate text-xs sm:text-sm text-neutral-700 dark:text-neutral-300" title={d.name}>
                {d.name}
              </div>
              <div className="flex-1 h-4 bg-neutral-100 dark:bg-neutral-800 rounded overflow-hidden">
                <div
                  className={`h-full flex items-center px-2 text-[11px] font-semibold text-white ${barClass}`}
                  style={{ width: `${pct}%` }}
                >
                  {isFree && <span className="truncate">Free</span>}
                  {!isFree && d.amount != null && <span className="truncate">{`$${d.amount}`}</span>}
                </div>
              </div>
              <div className="w-14 shrink-0 text-right text-xs font-medium text-neutral-600 dark:text-neutral-300">
                {isFree ? 'Free' : d.amount == null ? '—' : `$${d.amount}`}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-neutral-400">Entry-level price from each tool&apos;s pricing page.</p>
    </div>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendations, setRecommendations] = useState<AIModel[]>([]);
  const [useAi, setUseAi] = useState(false); // OFF = free instant engine, ON = Gemini AI
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(4);
  const [hasSearched, setHasSearched] = useState(false);
  const [staticSuggestions, setStaticSuggestions] = useState<AIModel[]>(getSuggestions("All"));
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resultSource, setResultSource] = useState<"gemini" | "keyword" | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  // Budget filter: 'any' | 'free' | '10' | '20' | '50'
  const [budget, setBudget] = useState<string>('any');
  // Mobile: whether the Filters panel (category + budget) is expanded in the sticky bar
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Personalization: saved profile ("I'm a solo dev") tailors AI recommendations
  const { profile, saveProfile } = useProfile();
  const [profileDraft, setProfileDraft] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Restore saved theme on mount; if the user never chose, follow their OS
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') setDarkMode(true);
    else if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  // Apply theme class and persist
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Deep-link support: /?q=ChatGPT&ai=1 pre-fills and runs an AI-mode search.
  // Used by shortlist links ("compare in AI Mode") and share cards.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (!q || !q.trim()) return;
    if (params.get("ai") === "1") setUseAi(true);
    setSearchQuery(q);
    runSearch(q);
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs for stale-request discarding
  const latestRequestRef = useRef(0);

  const categories = ["All", ...Array.from(new Set(aiDatabase.map(ai => ai.category)))];

  const getRecommendations = async (query: string) => {
    if (!query.trim()) return [];

    // Defensive guard: limit the amount of text sent to the API
    const limitedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
    if (!limitedQuery) return [];

    // Track request order so a slow earlier request never overwrites newer results
    const requestId = ++latestRequestRef.current;

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: limitedQuery,
          category: selectedCategory === 'All' ? undefined : selectedCategory,
          useAi,
          budget: budget === 'any' ? null : budget,
          profile: profile || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        if (requestId !== latestRequestRef.current) return null; // stale, discard
        setSearchError(
          response.status === 429
            ? 'You are searching too fast — please wait a moment and try again.'
            : errData?.error || `Search failed (${response.status}).`
        );
        return [];
      }

      const data = await response.json();
      if (requestId !== latestRequestRef.current) return null; // stale, discard
      setSearchError(null);
      setResultSource(data.source === 'gemini' ? 'gemini' : data.source === 'keyword' ? 'keyword' : null);
      setGeminiError(data.geminiError || null);
      return data.recommendations || [];
    } catch (error) {
      console.error('Error getting recommendations:', error);
      if (requestId !== latestRequestRef.current) return null; // stale, discard
      // Fallback to basic matching
      const lowerQuery = limitedQuery.toLowerCase();

      return aiDatabase.filter(ai => {
        const matchesCategory = selectedCategory === "All" || ai.category === selectedCategory;
        const matchesSearch =
          ai.name.toLowerCase().includes(lowerQuery) ||
          ai.description.toLowerCase().includes(lowerQuery) ||
          ai.strengths.some(s => s.toLowerCase().includes(lowerQuery)) ||
          ai.bestFor.some(b => b.toLowerCase().includes(lowerQuery)) ||
          ai.category.toLowerCase().includes(lowerQuery);

        return matchesCategory && matchesSearch;
      });
    }
  };

  const runSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setDisplayCount(4);
    setSelectedCategory("All");
    setHasSearched(true);
    const results = await getRecommendations(query);
    // null = a newer request superseded this one
    if (results !== null) setRecommendations(results);
    setIsLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch(searchQuery);
  };

  // Trigger AI search when category is clicked
  const handleCategoryClick = async (category: string) => {
    setIsLoading(true);
    setSelectedCategory(category);
    setDisplayCount(4); // Reset display count
    setHasSearched(true); // Mark that user has searched
    // Use category as the search query for AI
    const query = category === 'All' ? 'AI tools' : category;
    setSearchQuery(query); // Update the search input to show the category
    const results = await getRecommendations(query);
    setRecommendations(results);
    setIsLoading(false);
  };

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 4);
  };

  // Load more tools for the popular/category view by querying the AI
  const handleLoadMorePopular = async () => {
    setIsLoading(true);
    const query = selectedCategory === 'All' ? 'AI tools' : selectedCategory;
    setSearchQuery(query);
    const results = await getRecommendations(query);
    // Only append tools that match the active category (unless All)
    const filtered = selectedCategory === 'All'
      ? results
      : results.filter((ai: AIModel) => ai.category === selectedCategory);
    setStaticSuggestions(prev => {
      // Merge without duplicate names
      const merged = [...prev];
      for (const ai of filtered) {
        if (!merged.some(existing => existing.name === ai.name)) {
          merged.push(ai);
        }
      }
      return merged;
    });
    setDisplayCount(prev => prev + 4);
    setIsLoading(false);
  };

  // Update static suggestions when category changes (but not searching)
  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    setStaticSuggestions(getSuggestions(category));
    setDisplayCount(4); // Reset how many are visible when switching category
    setHasSearched(false); // Reset search state when just filtering
  };

  // Re-run the search when the budget filter changes so the server reapplies
  // its constraints/ranking (the render filter below is a safety net too).
  useEffect(() => {
    if (hasSearched && searchQuery.trim()) {
      runSearch(searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget]);

  // Budget-filtered views used for this render (results + pre-search list).
  const visibleRecs = recommendations.filter((ai) => toolPassesBudget(ai.pricing, budget));
  const visibleStatic = staticSuggestions.filter((ai) => toolPassesBudget(ai.pricing, budget));

  return (
    <main className="min-h-screen transition-colors">
      {/* Subtle light-blue ambient glows - only in the top corners, fading away */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(700px circle at 12% -5%, rgba(147,197,253,0.12), transparent 60%), radial-gradient(600px circle at 88% -8%, rgba(147,197,253,0.10), transparent 55%)",
        }}
      />
      {/* WebGL grid texture in the side gutters (desktop only) */}
      <GridCanvas dark={darkMode} />
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-8 sm:pb-16">
        {/* Header */}
        <header className="mb-10 sm:mb-16">
          <h1 className="flex items-center gap-2.5 text-4xl sm:text-5xl font-black text-neutral-900 dark:text-neutral-50 mb-2 sm:mb-4 tracking-tight">
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0">
              <rect x="1.5" y="1.5" width="29" height="29" rx="8" className="fill-neutral-900 dark:fill-neutral-50" />
              <circle cx="14.5" cy="14.5" r="6" stroke="none" className="fill-neutral-50 dark:fill-neutral-900" />
              <path d="M19 19L24 24" className="stroke-neutral-50 dark:stroke-neutral-900" strokeWidth="3" strokeLinecap="round" />
            </svg>
            aiDexer
          </h1>
          <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-xl">
            Find the right AI tool for what you're trying to do
          </p>
        </header>

          <div className="sticky top-0 z-30 -mx-4 mb-6 sm:-mx-6 sm:mb-8">
            <div className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
              {/* Single row: search + budget + category + Search (desktop) / search + Filters (mobile) */}
              <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2">
                <label htmlFor="main-search" className="sr-only">What do you want to do?</label>
                <div className="relative flex-1 min-w-0">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                  <input
                    id="main-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value.slice(0, MAX_QUERY_LENGTH))}
                    placeholder="Describe what you want to do…"
                    maxLength={MAX_QUERY_LENGTH}
                    className="w-full pl-9 pr-3 py-2 text-sm sm:text-base font-medium text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-full focus:border-neutral-900 dark:focus:border-neutral-100 focus:ring-0 outline-none transition-colors"
                  />
                </div>
                {/* Budget dropdown (desktop) */}
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  aria-label="Budget"
                  className="hidden sm:block shrink-0 px-3 py-2 text-sm font-medium rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                >
                  {BUDGET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {/* Category dropdown (desktop) */}
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryClick(e.target.value)}
                  aria-label="Category"
                  className="hidden sm:block shrink-0 max-w-40 px-3 py-2 text-sm font-medium rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="shrink-0 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-full hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (useAi ? 'Asking…' : 'Searching…') : 'Search'}
                </button>
                {/* Mobile-only: toggle the filters panel */}
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  aria-expanded={filtersOpen}
                  className="md:hidden shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h12M20 18h0" />
                    <circle cx="15" cy="6" r="2" />
                    <circle cx="9" cy="12" r="2" />
                    <circle cx="18" cy="18" r="2" />
                  </svg>
                  {filtersOpen ? 'Close' : 'Filters'}
                </button>
                {/* AI mode toggle (own row on mobile, inline on desktop) */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={useAi}
                  onClick={() => setUseAi((prev) => !prev)}
                  className="flex w-full sm:w-auto shrink-0 items-center justify-center sm:justify-start gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  <span className={useAi ? 'text-neutral-900 dark:text-neutral-100 font-semibold' : ''}>AI Mode</span>
                  <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${useAi ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${useAi ? 'translate-x-5 bg-white dark:bg-neutral-900' : 'translate-x-1 bg-white'}`} />
                  </span>
                </button>
              </form>
              {/* Mobile filters panel: budget + category + AI mode */}
              {filtersOpen && (
                <div className="md:hidden px-4 pb-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Budget</span>
                    <select
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      aria-label="Budget"
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    >
                      {BUDGET_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Category</span>
                    <select
                      value={selectedCategory}
                      onChange={(e) => handleCategoryClick(e.target.value)}
                      aria-label="Category"
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {/* Personal profile: saved context that tailors AI recommendations */}
              <div className="px-4 sm:px-6 pb-3">
                {profileOpen ? (
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
                    <label htmlFor="profile-input" className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                      Your profile <span className="normal-case font-normal">— helps AI Mode tailor picks</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="profile-input"
                        type="text"
                        value={profileDraft}
                        onChange={(e) => {
                          setProfileDraft(e.target.value.slice(0, 200));
                          setProfileSaved(false);
                        }}
                        placeholder="e.g. I'm a solo dev building a SaaS side project"
                        maxLength={200}
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            saveProfile(profileDraft);
                            setProfileSaved(true);
                            setProfileOpen(false);
                          }}
                          disabled={!profileDraft.trim()}
                          className="px-4 py-2 text-sm font-semibold rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            setProfileDraft(profile);
                          }}
                          className="px-4 py-2 text-sm font-medium rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                      Saved on this device{profile ? "" : " — empty for now"}. Sign in to sync it across devices.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDraft(profile);
                      setProfileOpen(true);
                      setProfileSaved(false);
                    }}
                    className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                  >
                    {profile
                      ? profileSaved
                        ? `✓ Profile saved: “${profile.length > 48 ? profile.slice(0, 48) + "…" : profile}”`
                        : `Profile: “${profile.length > 48 ? profile.slice(0, 48) + "…" : profile}” — edit`
                      : "+ Add a profile so AI Mode knows who you are (optional)"}
                  </button>
                )}
              </div>
            </div>
          </div>

        {/* Results Section */}
        {hasSearched ? (
          searchError ? (
            <div className="mb-10 sm:mb-16 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 sm:p-6 text-red-700 dark:text-red-300">
              <p className="font-medium mb-1">Search problem</p>
              <p className="text-sm">{searchError}</p>
            </div>
          ) : visibleRecs.length > 0 ? (
            <div className="mb-10 sm:mb-16">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
                <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                  {visibleRecs.length} result{visibleRecs.length !== 1 ? 's' : ''} found
                </h2>
                {resultSource === 'gemini' && (
                  <span className="text-xs text-neutral-400">
                    AI picks
                  </span>
                )}
                {resultSource === 'keyword' && useAi && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    <p>Gemini unavailable right now — used built-in matching</p>
                    {geminiError && <p className="mt-0.5 font-mono text-amber-500">{geminiError}</p>}
                  </div>
                )}
              </div>
              <PriceChart tools={visibleRecs.slice(0, displayCount)} />
              <div className="space-y-4">
                {visibleRecs.slice(0, displayCount).map((ai, index) => (
                  <div
                    key={index}
                    className="border border-neutral-200 p-4 sm:p-6 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 mb-3">
                      <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                        {ai.name}
                      </h3>
                      <span className="text-xs sm:text-sm text-neutral-500">
                        {ai.category}
                      </span>
                    </div>

                    <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mb-4">
                      {ai.description}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">Best for:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {ai.bestFor.map((item, i) => (
                            <span key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
                              {item}{i !== ai.bestFor.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-8">
                        <div>
                          <span className="text-neutral-500">Pricing:</span>{' '}
                          <span className="text-neutral-900 dark:text-neutral-100">{ai.pricing}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Access:</span>{' '}
                          <span className="text-neutral-900 dark:text-neutral-100">{ai.access}</span>
                        </div>
                      </div>
                      <a
                        href={ai.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors sm:w-auto sm:py-2"
                      >
                        Visit {ai.name} →
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {displayCount < visibleRecs.length && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-8 py-3 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Load More
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Empty state: searched but nothing matched
            !isLoading && (
              <div className="mb-10 sm:mb-16 text-center py-8 sm:py-12 border border-neutral-200 dark:border-neutral-800">
                <p className="text-base sm:text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">No matches found</p>
                <p className="text-sm text-neutral-500 px-4">
                  Try describing what you want to do differently — e.g. &quot;edit videos for YouTube&quot; or &quot;write emails faster&quot;.
                </p>
              </div>
            )
          )
        ) : (
          // Static Suggestions (before user search)
          visibleStatic.length > 0 && (
            <div className="mb-10 sm:mb-16">
              <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-6">
                {selectedCategory === "All" ? "Popular AI Tools" : `Popular ${selectedCategory} Tools`}
              </h2>
              <PriceChart tools={visibleStatic.slice(0, displayCount)} />
              <div className="space-y-4">
                {visibleStatic.slice(0, displayCount).map((ai, index) => (
                  <div
                    key={index}
                    className="border border-neutral-200 p-4 sm:p-6 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 mb-3">
                      <h3 className="text-lg sm:text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                        {ai.name}
                      </h3>
                      <span className="text-xs sm:text-sm text-neutral-500">
                        {ai.category}
                      </span>
                    </div>

                    <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mb-4">
                      {ai.description}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">Best for:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {ai.bestFor.map((item, i) => (
                            <span key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
                              {item}{i !== ai.bestFor.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-8">
                        <div>
                          <span className="text-neutral-500">Pricing:</span>{' '}
                          <span className="text-neutral-900 dark:text-neutral-100">{ai.pricing}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Access:</span>{' '}
                          <span className="text-neutral-900 dark:text-neutral-100">{ai.access}</span>
                        </div>
                      </div>
                      <a
                        href={ai.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors sm:w-auto sm:py-2"
                      >
                        Visit {ai.name} →
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load More Button */}
              {displayCount < visibleStatic.length && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleLoadMorePopular}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-8 py-3 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>
          )
        )}

        </div>

        <footer className="mt-16 sm:mt-24 pb-4 text-center text-xs text-neutral-400 dark:text-neutral-500 space-y-1.5">
          <p>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Privacy Policy</Link>
            {" · "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">Terms of Service</Link>
          </p>
          <p>&copy; {new Date().getFullYear()} aiDexer. All rights reserved.</p>
          <p>
            Made by{" "}
            <a
              href="https://www.michaelwassie.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              Michael Wassie
            </a>
          </p>
        </footer>
    </main>
  );
}
