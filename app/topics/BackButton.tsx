"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-6 flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
      aria-label="Go back"
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}
