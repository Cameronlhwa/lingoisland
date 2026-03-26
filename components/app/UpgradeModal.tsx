"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAnalytics } from "@/lib/posthog/client";
import JourneyIslandPaywall from "@/components/app/JourneyIslandPaywall";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

type Entitlements = {
  isPro: boolean;
};

type JourneyNode = {
  id: string;
  node_type: "island" | "story";
  order?: number;
  position?: number;
  name: string;
  zh?: string | null;
  hint?: string | null;
  word_count?: number | null;
  completed_at?: string | null;
};

type JourneyActiveResponse = {
  journey: {
    topic?: string | null;
    words_per_week?: number | null;
  } | null;
  nodes?: JourneyNode[];
  islands?: JourneyNode[];
};

type LockedJourneyNode = {
  order: number;
  name: string;
  zh: string | null;
  node_type: "island" | "story";
  hint: string | null;
};

type PaywallFacts = {
  journeyTitle: string;
  wordsPerWeek: number;
  weeksToComplete: number;
  completedWords: number;
  lockedIslands: LockedJourneyNode[];
};

function getRawOrder(node: JourneyNode): number {
  if (typeof node.position === "number" && Number.isFinite(node.position)) {
    return node.position;
  }
  if (typeof node.order === "number" && Number.isFinite(node.order)) {
    return node.order;
  }
  return Number.MAX_SAFE_INTEGER;
}

function getDisplayOrderMap(nodes: JourneyNode[]): Map<string, number> {
  const displayOrderById = new Map<string, number>();
  const islands = nodes
    .filter((node) => node.node_type === "island")
    .sort((a, b) => getRawOrder(a) - getRawOrder(b));
  const stories = nodes
    .filter((node) => node.node_type === "story")
    .sort((a, b) => getRawOrder(a) - getRawOrder(b));

  islands.forEach((node, index) => {
    const islandIndex = index + 1;
    const displayOrder = islandIndex <= 2 ? islandIndex : islandIndex + 1;
    displayOrderById.set(node.id, displayOrder);
  });

  stories.forEach((node, index) => {
    const displayOrder = index === 0 ? 3 : 7 + (index - 1);
    displayOrderById.set(node.id, displayOrder);
  });

  return displayOrderById;
}

const DEFAULT_LOCKED_ISLANDS: LockedJourneyNode[] = [
  {
    order: 2,
    name: "Island 2",
    zh: null,
    node_type: "island" as const,
    hint: null,
  },
  {
    order: 3,
    name: "Story Checkpoint",
    zh: null,
    node_type: "story" as const,
    hint: "Reinforce your new words in context",
  },
  {
    order: 4,
    name: "Island 3",
    zh: null,
    node_type: "island" as const,
    hint: null,
  },
  {
    order: 5,
    name: "Island 4",
    zh: null,
    node_type: "island" as const,
    hint: null,
  },
  {
    order: 6,
    name: "Island 5",
    zh: null,
    node_type: "island" as const,
    hint: null,
  },
  {
    order: 7,
    name: "Final Story Checkpoint",
    zh: null,
    node_type: "story" as const,
    hint: "Lock everything in with a memorable story",
  },
];

const DEFAULT_PAYWALL_FACTS: PaywallFacts = {
  journeyTitle: "Your Mandarin Journey",
  wordsPerWeek: 10,
  weeksToComplete: 5,
  completedWords: 5,
  lockedIslands: DEFAULT_LOCKED_ISLANDS,
};

export default function UpgradeModal({ open, onClose, feature }: UpgradeModalProps) {
  const router = useRouter();
  const { captureEvent } = useAnalytics();
  const [mounted, setMounted] = useState(false);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loadingEntitlements, setLoadingEntitlements] = useState(false);
  const [paywallFacts, setPaywallFacts] = useState<PaywallFacts>(DEFAULT_PAYWALL_FACTS);
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "yearly" | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoadingEntitlements(true);
    void Promise.all([
      fetch("/api/entitlements")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch("/api/journey/active", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<JourneyActiveResponse>) : null))
        .catch(() => null),
    ])
      .then(([entitlementsData, journeyData]) => {
        setEntitlements(entitlementsData);
        if (!journeyData?.journey) {
          setPaywallFacts(DEFAULT_PAYWALL_FACTS);
          return;
        }

        const nodes = (journeyData.nodes ?? journeyData.islands ?? []).slice();
        const islandNodes = nodes.filter((node) => node.node_type === "island");
        const completedIslandWords = islandNodes
          .filter((node) => !!node.completed_at)
          .reduce((sum, node) => sum + (node.word_count ?? 10), 0);
        const wordsPerWeek = Math.max(1, journeyData.journey.words_per_week ?? 10);
        const weeksToComplete = Math.max(
          1,
          Math.ceil(50 / wordsPerWeek),
        );

        const displayOrderById = getDisplayOrderMap(nodes);

        const lockedNodes = nodes
          .map((node) => ({
            ...node,
            _displayOrder: displayOrderById.get(node.id) ?? getRawOrder(node),
          }))
          .filter((node) => {
          if (node.completed_at) return false;
          if (node.node_type === "story") return true;
          return node._displayOrder > 1;
          })
          .sort((a, b) => a._displayOrder - b._displayOrder);

        const lockedIslands =
          lockedNodes.length > 0
            ? lockedNodes.map((node) => ({
                order: node._displayOrder,
                name: node.name,
                zh: node.zh ?? null,
                node_type: node.node_type,
                hint: node.hint ?? null,
              }))
            : DEFAULT_LOCKED_ISLANDS;

        setPaywallFacts({
          journeyTitle: journeyData.journey.topic?.trim() || DEFAULT_PAYWALL_FACTS.journeyTitle,
          wordsPerWeek,
          weeksToComplete,
          completedWords: Math.max(0, completedIslandWords),
          lockedIslands,
        });
      })
      .catch(() => {
        setEntitlements(null);
        setPaywallFacts(DEFAULT_PAYWALL_FACTS);
      })
      .finally(() => setLoadingEntitlements(false));
  }, [open]);

  const startCheckout = async (interval: "monthly" | "yearly") => {
    if (checkoutLoading) return;
    setCheckoutLoading(interval);
    captureEvent("checkout_initiated", {
      interval,
      location: "upgrade_modal",
      feature: feature ?? undefined,
    });

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });

      if (response.status === 401) {
        onClose();
        router.push("/login");
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        return;
      }

      window.location.href = data.url as string;
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (!open || !mounted) return null;

  const isPro = entitlements?.isPro ?? false;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-4 pt-8 backdrop-blur-sm md:items-center md:pt-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1120px]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full bg-black/60 px-2.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-black/80"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="max-h-[88vh] overflow-y-auto rounded-2xl">
          {loadingEntitlements ? (
            <div className="rounded-2xl bg-white p-10 text-center text-gray-600">
              Loading...
            </div>
          ) : isPro ? (
            <div className="rounded-2xl bg-white p-8 text-center">
              <h2 className="text-2xl font-black text-gray-900">You already have Pro</h2>
              <p className="mt-2 text-sm text-gray-600">
                All premium features are unlocked for your account.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <JourneyIslandPaywall
                journeyTitle={paywallFacts.journeyTitle}
                wordsPerWeek={paywallFacts.wordsPerWeek}
                weeksToComplete={paywallFacts.weeksToComplete}
                completedWords={paywallFacts.completedWords}
                lockedIslands={paywallFacts.lockedIslands}
                onSubscribe={(interval) => void startCheckout(interval)}
              />
              {checkoutLoading ? (
                <p className="text-center text-xs font-semibold text-gray-500">
                  Redirecting to secure checkout...
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
