"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession as useAuthSession } from "./auth-client";

const BOOKMARKS_KEY = "aidexer:bookmarks";
const PROFILE_KEY = "aidexer:profile";
const BOOKMARKS_EVENT = "aidexer:bookmarks-changed";

/* ----------------------------- primitives ------------------------------ */

function readBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeBookmarks(list: string[]) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  } catch {}
}

/**
 * The signed-in user (null while loading or for guests). Bookmarks and the
 * profile use this to decide between localStorage-only (guest) and
 * server-synced (signed-in) persistence.
 */
export function useSessionUser() {
  const { data, isPending } = useAuthSession();
  return {
    user: data?.user ?? null,
    isPending,
    /** True once the session is known — use to avoid flashing sign-in UI. */
    ready: !isPending,
  };
}

/* ----------------------------- bookmarks ------------------------------- */

/**
 * Bookmarked tools ("personal shortlist").
 *
 * - Guests: persisted in localStorage only — no account needed.
 * - Signed in: synced to Postgres via /api/bookmarks; any guest bookmarks are
 *   merged (union) into the account on first load, and the local mirror is
 *   kept in sync so signing out preserves a usable copy.
 */
export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [synced, setSynced] = useState(false); // server round-trip done (signed-in)
  const { user, ready } = useSessionUser();
  const syncedUserRef = useRef<string | null>(null);

  const refreshLocal = useCallback(() => setBookmarks(readBookmarks()), []);

  useEffect(() => {
    refreshLocal();
    const sync = () => refreshLocal();
    window.addEventListener(BOOKMARKS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BOOKMARKS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [refreshLocal, user?.id]);

  // Sign-in sync: merge guest shortlist into the account once per user.
  useEffect(() => {
    if (!ready) return;
    if (!user) {
      syncedUserRef.current = null;
      setSynced(false);
      refreshLocal();
      return;
    }
    if (syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;
    const local = readBookmarks();
    fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge: local }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.bookmarks)) {
          writeBookmarks(d.bookmarks);
          setBookmarks(d.bookmarks);
        }
        setSynced(true);
      })
      .catch(() => setSynced(true));
  }, [ready, user, refreshLocal]);

  const toggle = useCallback(
    (name: string) => {
      const current = readBookmarks();
      const has = current.includes(name);
      const next = has ? current.filter((n) => n !== name) : [...current, name];
      writeBookmarks(next);
      setBookmarks(next);
      window.dispatchEvent(new Event(BOOKMARKS_EVENT));

      // Best-effort server sync; guests just skip this.
      if (user) {
        fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: name, action: has ? "remove" : "add" }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && Array.isArray(d.bookmarks)) {
              writeBookmarks(d.bookmarks);
              setBookmarks(d.bookmarks);
              window.dispatchEvent(new Event(BOOKMARKS_EVENT));
            }
          })
          .catch(() => {});
      }
    },
    [user]
  );

  return { bookmarks, toggle, synced, isGuest: ready && !user };
}

/* ------------------------------ profile -------------------------------- */

/**
 * Saved user profile, e.g. "I'm a solo dev" — tailors AI recommendations.
 * Guests: localStorage. Signed-in users: synced to /api/profile (Postgres).
 */
export function useProfile() {
  const [profile, setProfileState] = useState("");
  const { user, ready } = useSessionUser();
  const syncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setProfileState(localStorage.getItem(PROFILE_KEY) ?? "");
    } catch {}
  }, []);

  // Pull the server profile once per signed-in user.
  useEffect(() => {
    if (!ready || !user || syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.profile === "string" && d.profile) {
          setProfileState(d.profile);
          try {
            localStorage.setItem(PROFILE_KEY, d.profile);
          } catch {}
        }
      })
      .catch(() => {});
  }, [ready, user]);

  const saveProfile = useCallback(
    (value: string) => {
      const trimmed = value.trim().slice(0, 200);
      setProfileState(trimmed);
      try {
        if (trimmed) localStorage.setItem(PROFILE_KEY, trimmed);
        else localStorage.removeItem(PROFILE_KEY);
      } catch {}
      if (user) {
        fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: trimmed }),
        }).catch(() => {});
      }
    },
    [user]
  );

  return { profile, saveProfile, isGuest: ready && !user };
}

