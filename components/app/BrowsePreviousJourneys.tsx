'use client';

import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import type { CompletedJourney } from '@/types/journey';

export function BrowsePreviousJourneys({ pastJourneys }: { pastJourneys: CompletedJourney[] }) {
  const router = useRouter();

  if (!pastJourneys || pastJourneys.length === 0) return null;

  return (
    <div className="mt-4 max-w-[520px] mx-auto">
      <button
        type="button"
        onClick={() => router.push('/app/journey/past')}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 transition-all hover:border-gray-300 hover:text-gray-700"
      >
        <div className="flex items-center gap-2.5">
          <Clock size={14} className="text-gray-400" />
          <span>My Journeys</span>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {pastJourneys.length}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-gray-400">View all →</span>
      </button>
    </div>
  );
}
