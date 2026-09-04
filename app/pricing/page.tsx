"use client";

import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Suspense, useState } from "react";
import { useAnalytics } from "@/lib/posthog/client";

type Interval = "monthly" | "yearly";
type Product = "core" | "hsk";

const PLANS: Record<
  Product,
  {
    name: string;
    description: string;
    monthly: string;
    yearly: string;
    yearlyDetail: string;
    features: string[];
  }
> = {
  core: {
    name: "Topic Islands Pro",
    description: "Build vocabulary around the conversations and topics that matter to you.",
    monthly: "$9.99",
    yearly: "$6.67",
    yearlyDetail: "$79.99 billed yearly",
    features: [
      "Unlimited Topic Islands",
      "Stories, quizzes, and flashcards",
      "Unlimited learning chat",
    ],
  },
  hsk: {
    name: "HSK Prep Pro",
    description: "Follow a personalized path to your next HSK level.",
    monthly: "$14.99",
    yearly: "$9.99",
    yearlyDetail: "$119.88 billed yearly",
    features: [
      "Personalized HSK curriculum",
      "Official HSK vocabulary in context",
      "Practice tests and smart review",
    ],
  },
};

export default function PricingPage() {
  return (
    <Suspense
      fallback={<main className="min-h-screen bg-slate-50" aria-busy="true" />}
    >
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const searchParams = useSearchParams();
  const requestedProduct = searchParams.get("product");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { captureEvent } = useAnalytics();
  const highlightedProduct: Product =
    requestedProduct === "hsk" ? "hsk" : "core";

  const startCheckout = async (product: Product, interval: Interval) => {
    const checkoutKey = `${product}-${interval}`;
    setLoading(checkoutKey);
    setError(null);
    captureEvent("checkout_initiated", {
      product,
      interval,
      location: "pricing_page",
    });
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval, product }),
      });

      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(
          `/pricing?product=${product}`,
        )}`;
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
    <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-700">
            Choose your learning path
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Plans built for how you want to learn Mandarin
          </h1>
          <p className="mt-4 text-base text-slate-600">
            Topic Islands and HSK Prep are separate products. Choose one now,
            then add the other whenever you need it.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {(Object.keys(PLANS) as Product[]).map((product) => {
            const plan = PLANS[product];
            const emphasized = product === highlightedProduct;
            return (
              <section
                key={product}
                className={`rounded-3xl border bg-white p-6 shadow-sm sm:p-8 ${
                  emphasized
                    ? "border-cyan-500 ring-2 ring-cyan-100"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{plan.name}</h2>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">
                      {plan.description}
                    </p>
                  </div>
                  {emphasized ? (
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                      Recommended
                    </span>
                  ) : null}
                </div>

                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-cyan-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <PlanButton
                    label="Monthly"
                    price={plan.monthly}
                    detail="per month"
                    loading={loading === `${product}-monthly`}
                    disabled={loading !== null}
                    onClick={() => void startCheckout(product, "monthly")}
                  />
                  <PlanButton
                    label="Annual"
                    price={plan.yearly}
                    detail={plan.yearlyDetail}
                    badge="Best value"
                    loading={loading === `${product}-yearly`}
                    disabled={loading !== null}
                    onClick={() => void startCheckout(product, "yearly")}
                  />
                </div>
              </section>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Cancel anytime from your account settings. Prices are in USD.
        </p>
      </div>

      {error ? (
        <div className="fixed inset-x-6 bottom-6 mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700 shadow-lg">
          {error}
        </div>
      ) : null}
    </main>
  );
}

function PlanButton({
  label,
  price,
  detail,
  badge,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  price: string;
  detail: string;
  badge?: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative rounded-xl border border-slate-200 p-4 text-left transition hover:border-cyan-500 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {badge ? (
        <span className="absolute -top-2 right-3 rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{loading ? "…" : price}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </button>
  );
}
