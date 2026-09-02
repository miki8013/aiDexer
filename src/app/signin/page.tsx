"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteNav from "../SiteNav";
import { authClient } from "@/lib/auth-client";

/**
 * Sign in / create account. Browsing works without an account — this exists
 * purely to sync your shortlist, profile, and votes across devices.
 */
export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const res =
        mode === "signup"
          ? await authClient.signUp.email({ name: name.trim() || email.split("@")[0], email, password })
          : await authClient.signIn.email({ email, password });
      if (res.error) {
        setError(res.error.message ?? "Something went wrong. Try again.");
        setBusy(false);
      } else {
        // Clear the password immediately and show a clear confirmation instead
        // of a blink-and-you-miss-it redirect.
        setPassword("");
        setSuccess(
          mode === "signup"
            ? "Account created! Taking you back to the homepage…"
            : "Signed in! Taking you back to the homepage…"
        );
        // Give shortlist/profile sync hooks a moment to merge guest data,
        // then navigate.
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1200);
      }
    } catch {
      setError("Network error — please check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen">
      <SiteNav />
      <div className="max-w-sm mx-auto px-4 pt-10 pb-16">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          Browsing is always free and needs no account. Signing in syncs your
          shortlist, profile, and votes across devices.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
              Password {mode === "signup" && <span className="normal-case font-normal">(8+ characters)</span>}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-4">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            className="font-semibold underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="mt-6 text-sm">
          <Link href="/" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            ← Keep browsing as a guest
          </Link>
        </p>
      </div>
    </main>
  );
}
