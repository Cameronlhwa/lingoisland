"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function HskWaitlistForm({
  source,
  id = "hsk-waitlist-email",
  showIntro = true,
}: {
  source: "onboarding" | "upgrade" | "pricing";
  id?: string;
  /** Short note about December and the experience still being finished. */
  showIntro?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user?.email || user.is_anonymous) return;
      setEmail((current) => current || user.email || "");
    });
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/hsk/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setError(data.error || "Could not join the waitlist.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Could not join the waitlist. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div
        className="rounded-xl px-3.5 py-3 text-center"
        style={{
          background: "var(--lingo-sky-pale, #FBF6F1)",
          border: "1px solid var(--lingo-border, rgba(95, 49, 25, 0.12))",
        }}
      >
        <p className="text-sm font-bold" style={{ color: "var(--lingo-navy, #5F3119)" }}>
          You&apos;re on the list.
        </p>
        <p
          className="mt-1 text-[12.5px] leading-relaxed"
          style={{ color: "var(--lingo-text-muted, #7A6456)" }}
        >
          We&apos;ll email you when HSK 3.0 opens in December.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      {showIntro ? (
        <p
          className="text-[12.5px] leading-relaxed"
          style={{ color: "var(--lingo-text-muted, #7A6456)" }}
        >
          We&apos;re currently perfecting the experience. The new HSK 3.0 launches in
          December — join the waitlist and we&apos;ll email you when it&apos;s ready.
        </p>
      ) : null}
      <label className="sr-only" htmlFor={id}>
        Email
      </label>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        placeholder="Email address"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
        style={{
          marginTop: showIntro ? 12 : 0,
          borderColor: "var(--lingo-border, rgba(95, 49, 25, 0.12))",
          color: "var(--lingo-navy, #5F3119)",
        }}
      />
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-2.5 flex w-full items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 disabled:hover:translate-y-0"
        style={{
          background: "var(--lingo-btn-bg, #20674F)",
          boxShadow: "var(--lingo-btn-shadow)",
        }}
      >
        {status === "loading" ? "Joining…" : "Join the waitlist"}
      </button>
    </form>
  );
}
