"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { slugify } from "@/lib/tools";
import { useBookmarks, useSessionUser } from "@/lib/hooks";
import { authClient } from "@/lib/auth-client";

const links = [
  { href: "/", label: "Home" },
  { href: "/tools", label: "All Tools" },
  { href: "/compare", label: "Compare" },
  { href: "/digest", label: "Weekly Digest" },
];

/** Account menu + shortlist popover + dark-mode toggle in the floating nav. */
export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState<false | "shortlist" | "account">(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, ready } = useSessionUser();
  const { bookmarks, toggle } = useBookmarks();

  // Sync with the theme applied by the inline script in layout.tsx
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  // Close menus on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      const inMenu = menuRef.current?.contains(e.target as Node);
      const onShortlist = (e.target as HTMLElement)?.closest?.("[data-shortlist-root]");
      if (!inMenu && !onShortlist) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    setMenuOpen(false);
    router.refresh();
  };

  return (
    <nav className="relative z-40 flex justify-center px-4 pt-3 pb-2">
      <div className="flex items-center gap-1 sm:gap-2 rounded-full border border-neutral-200/80 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur px-2 py-1.5 shadow-sm">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
        {/* Shortlist popover */}
        <div className="relative" data-shortlist-root>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => (o === "shortlist" ? false : "shortlist"))}
            aria-expanded={menuOpen === "shortlist"}
            aria-label="Your shortlist"
            className={`px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              menuOpen === "shortlist"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            â˜… Shortlist{bookmarks.length > 0 ? ` (${bookmarks.length})` : ""}
          </button>
          {menuOpen === "shortlist" && (
            <div className="absolute right-0 top-full mt-2 w-72 max-w-[85vw] rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg p-3">
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                Your shortlist
              </p>
              {bookmarks.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Nothing saved yet. Tap â˜… Save on any tool.
                </p>
              ) : (
                <ul className="space-y-1 max-h-64 overflow-y-auto">
                  {bookmarks.map((name) => (
                    <li key={name} className="flex items-center justify-between gap-2">
                      <Link
                        href={`/tools/${slugify(name)}`}
                        onClick={() => setMenuOpen(false)}
                        className="text-sm font-medium truncate hover:underline"
                      >
                        {name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggle(name)}
                        aria-label={`Remove ${name} from shortlist`}
                        className="text-neutral-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        âœ•
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                {user
                  ? "Synced to your account."
                  : "Saved on this device â€” sign in to sync everywhere."}
              </p>
            </div>
          )}
        </div>
        {/* Account menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => (o === "account" ? false : "account"))}
            aria-expanded={menuOpen === "account"}
            aria-label="Account"
            className={`p-2 rounded-full transition-colors ${
              menuOpen === "account"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
            </svg>
          </button>
          {menuOpen === "account" && (
            <div className="absolute right-0 top-full mt-2 w-60 max-w-[85vw] rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg p-3 text-sm">
              {!ready ? null : user ? (
                <>
                  <p className="font-semibold truncate">{user.name || user.email}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mb-2">
                    {user.email}
                  </p>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-2">
                    You&apos;re browsing as a guest. Sign in to sync your shortlist
                    and profile across devices.
                  </p>
                  <Link
                    href="/signin"
                    onClick={() => setMenuOpen(false)}
                    className="block text-center px-3 py-2 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle dark mode"
          onClick={toggleTheme}
          className="ml-1 p-2 rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          {dark ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>


      </div>
    </nav>
  );
}
