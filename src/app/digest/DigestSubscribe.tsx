"use client";

import { useState } from "react";

/** Email capture for the weekly digest. */
export default function DigestSubscribe() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/digest/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setState("done");
        setMessage(data?.message ?? "You're on the list!");
      } else {
        setState("error");
        setMessage(data?.error ?? "Something went wrong.");
      }
    } catch {
      setState("error");
      setMessage("Network error — try again.");
    }
  };

  return (
    <section className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight mb-1">Get the digest weekly</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        One email a week. New tools, no fluff, unsubscribe anytime.
      </p>
      {state === "done" ? (
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">✓ {message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            className="flex-1 px-4 py-2.5 text-sm rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-full hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-60"
          >
            {state === "sending" ? "Subscribing…" : "Subscribe"}
          </button>
        </form>
      )}
      {state === "error" && <p className="mt-2 text-xs text-red-600">{message}</p>}
    </section>
  );
}
