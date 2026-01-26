"use client";

import { motion, useReducedMotion } from "framer-motion";

type FeatureCardProps = {
  title: string;
  description: string;
};

export default function FeatureCard({ title, description }: FeatureCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all"
    >
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {description}
      </p>
    </motion.div>
  );
}

