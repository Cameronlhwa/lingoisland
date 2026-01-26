"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type CTAButtonCardProps = {
  href: string;
  title: string;
  microcopy: string[];
  variant?: "primary" | "secondary";
  tooltip?: {
    label: string;
    content: string;
  };
};

export default function CTAButtonCard({
  href,
  title,
  microcopy,
  variant = "primary",
  tooltip,
}: CTAButtonCardProps) {
  const tooltipId = useId();
  const prefersReducedMotion = useReducedMotion();
  const isPrimary = variant === "primary";

  return (
    <Link href={href} className="block">
      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`flex min-h-[150px] flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all ${
          isPrimary
            ? "border-gray-200 hover:border-gray-300 hover:shadow-md"
            : "border-gray-200 hover:border-gray-300 hover:shadow-md"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-semibold text-gray-900 md:text-3xl">
                {title}
              </h3>
              {tooltip && (
                <div className="group relative">
                  <span className="text-xs font-medium text-gray-600 underline-offset-2 group-hover:underline">
                    {tooltip.label}
                  </span>
                  <div
                    id={tooltipId}
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-6 z-10 w-64 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                  >
                    {tooltip.content}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-3 text-base leading-relaxed text-gray-600">
              {microcopy.join(" ")}
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
