'use client';

import { useRouter } from 'next/navigation';
import { Check, Calendar } from 'lucide-react';
import { MiniNodeRail } from './MiniNodeRail';
import type { CompletedJourney } from '@/types/journey';

function formatMonthYear(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function JourneyPostCard({ journey }: { journey: CompletedJourney }) {
  const router = useRouter();
  const nodes = [...journey.journey_islands].sort((a, b) => a.position - b.position);

  const islandCount = nodes.filter((n) => n.node_type === 'island').length;
  const storyCount = nodes.filter((n) => n.node_type === 'story').length;
  const wordCount = nodes
    .filter((n) => n.node_type === 'island' && !!n.completed_at)
    .reduce((sum, n) => sum + (n.word_count ?? 0), 0);

  return (
    <button
      onClick={() => router.push(`/app/journey/${journey.id}`)}
      className="group text-left w-full rounded-2xl overflow-hidden border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all bg-white"
    >
      {/* Teal → blue gradient top stripe */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #14b8a6, #0ea5e9)' }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-black text-gray-900 text-sm leading-tight">
              {journey.topic}
            </h3>
          </div>
          {/* Stamp — slightly rotated, straightens on hover */}
          <div className="flex-shrink-0 border-2 border-teal-400 rounded-xl px-2 py-1 rotate-3 group-hover:rotate-0 transition-transform duration-200">
            <div className="flex items-center gap-1">
              <Check size={9} className="text-teal-500" strokeWidth={3} />
              <span className="text-[9px] font-black text-teal-500 uppercase tracking-wide">Done</span>
            </div>
          </div>
        </div>

        {/* Mini node rail */}
        {nodes.length > 0 && (
          <div className="mb-3">
            <MiniNodeRail nodes={nodes} />
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-bold text-gray-500">{wordCount} words</span>
          <span className="text-gray-200">·</span>
          <span className="text-[10px] font-bold text-gray-500">
            {islandCount} island{islandCount !== 1 ? 's' : ''}
          </span>
          {storyCount > 0 && (
            <>
              <span className="text-gray-200">·</span>
              <span className="text-[10px] font-bold text-gray-500">
                {storyCount} stor{storyCount !== 1 ? 'ies' : 'y'}
              </span>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Calendar size={9} />
            <span>
              {journey.completed_at
                ? `Completed ${formatMonthYear(journey.completed_at)}`
                : `Started ${formatMonthYear(journey.created_at)}`}
            </span>
          </div>
          <span className="text-[10px] font-bold text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity">
            Open →
          </span>
        </div>
      </div>
    </button>
  );
}
