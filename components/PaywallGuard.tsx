"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import UpgradeModal from "@/components/app/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";

interface PaywallGuardProps {
  children: ReactNode;
  featureHint?: string;
  enabled?: boolean;
}

export default function PaywallGuard({
  children,
  featureHint,
  enabled = true,
}: PaywallGuardProps) {
  const { isPro, isLoading } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  if (!enabled) {
    return <>{children}</>;
  }

  const shouldBlock = isLoading || !isPro;

  const interceptClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!shouldBlock) return;
    if (isLoading) return;
    event.preventDefault();
    event.stopPropagation();
    setShowUpgradeModal(true);
  };

  const interceptKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!shouldBlock) return;
    if (isLoading) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    setShowUpgradeModal(true);
  };

  return (
    <>
      <div
        onClickCapture={interceptClick}
        onKeyDownCapture={interceptKey}
        aria-disabled={shouldBlock}
      >
        {children}
      </div>
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={featureHint}
      />
    </>
  );
}
