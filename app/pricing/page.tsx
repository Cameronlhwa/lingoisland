"use client";

import { useState } from "react";

type Interval = "monthly" | "yearly";

export default function PricingPage() {
  const [loading, setLoading] = useState<Interval | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (interval: Interval) => {
    setLoading(interval);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });

      if (response.status === 401) {
        window.location.href = "/login?next=/pricing";
        return;
      }

      const data = await response.json();
      if (!response.ok || !data.url) {
        setError(data.error || "Unable to start checkout.");
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("Error starting checkout:", err);
      setError("Unable to start checkout.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Pricing</h1>
        <p className="mt-2 text-gray-600">
          Choose monthly or yearly Pro access. You can manage billing anytime.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => startCheckout("monthly")}
          className="rounded-xl border border-gray-900 bg-gray-900 px-6 py-4 text-left text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading !== null}
        >
          <div className="text-lg font-semibold">Pro Monthly</div>
          <div className="mt-1 text-sm text-gray-200">Billed monthly</div>
        </button>
        <button
          onClick={() => startCheckout("yearly")}
          className="rounded-xl border border-gray-200 bg-white px-6 py-4 text-left text-gray-900 transition-colors hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={loading !== null}
        >
          <div className="text-lg font-semibold">Pro Yearly</div>
          <div className="mt-1 text-sm text-gray-500">Billed yearly</div>
        </button>
      </div>
    </main>
  );
}
