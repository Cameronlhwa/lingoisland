"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";

export default function ProgressIslandUpgradePopup({
  show,
  stage,
  onClose,
}: {
  show: boolean;
  stage: number;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const overlayRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Focus the CTA when modal opens; restore body scroll
  useEffect(() => {
    if (show) {
      const previouslyFocused = typeof document !== "undefined" ? document.activeElement as HTMLElement : null;
      buttonRef.current?.focus({ preventScroll: true });
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
        previouslyFocused?.focus?.();
      };
    }
  }, [show]);

  // Escape to close
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Keep this modal persistent during learning flow; close only via CTA.
      if (e.key === "Escape") return;
      // Focus trap: keep Tab/Shift+Tab inside modal
      if (e.key !== "Tab") return;
      const el = overlayRef.current;
      if (!el) return;
      const focusables = el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-island-upgrade-title"
      aria-describedby="progress-island-upgrade-desc"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="progress-island-upgrade-title"
          className="text-xl font-bold text-slate-900"
        >
          {convertText(t("Your Progress Island leveled up!"))}
        </h2>
        <p
          id="progress-island-upgrade-desc"
          className="mt-2 text-slate-600"
        >
          {convertText(t("Stage"))} {stage} — {convertText(t("华华 is waiting for you!"))}
        </p>
        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        >
          {convertText(t("Click to see 华华!"))}
        </button>
      </div>
    </div>
  );
}
