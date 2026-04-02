'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { CompletedJourney } from '@/types/journey';

const ACCENT_COLORS = [
  '#14b8a6',
  '#0ea5e9',
  '#1a2332',
  '#0f766e',
  '#0284c7',
  '#6366f1',
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function FerryTicketCard({
  journey,
  index,
}: {
  journey: CompletedJourney;
  index: number;
}) {
  const router = useRouter();
  const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const islandNodes = journey.journey_islands.filter(
    (n) => n.node_type === 'island',
  );
  const islandCount = islandNodes.length;
  const totalWords =
    islandNodes.reduce((sum, n) => sum + (n.word_count ?? 0), 0) ||
    islandCount * 10;
  const isCompleted = !!journey.completed_at;

  return (
    <button
      type="button"
      onClick={() => router.push(`/app/journey/${journey.id}`)}
      style={{
        display: 'flex',
        width: 320,
        height: 160,
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        background: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.14)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
    >
      {/* Left accent strip */}
      <div style={{ width: 8, background: accentColor, flexShrink: 0 }} />

      {/* Left half */}
      <div
        style={{
          flex: 1,
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <div>
          <p
            style={{
              fontWeight: 900,
              color: '#1a2332',
              fontSize: 14,
              lineHeight: 1.35,
              marginBottom: 5,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {journey.topic}
          </p>
          <p style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
            {formatDate(journey.created_at)}
          </p>
        </div>
        <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
          {islandCount} island{islandCount !== 1 ? 's' : ''} · {totalWords}{' '}
          words
        </p>
      </div>

      {/* Perforated divider */}
      <div
        style={{
          width: 0,
          borderLeft: '2px dashed #e5e7eb',
          margin: '14px 0',
          flexShrink: 0,
        }}
      />

      {/* Right stub */}
      <div
        style={{
          width: 96,
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 30, lineHeight: 1 }}>🏝️</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: isCompleted ? '#0f766e' : '#1a4a6b',
            background: isCompleted ? '#ccfbf1' : '#dbeafe',
            padding: '3px 8px',
            borderRadius: 9999,
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          {isCompleted ? 'Completed' : 'In Progress'}
        </span>
      </div>
    </button>
  );
}

export function PastJourneysModal({
  isOpen,
  onClose,
  pastJourneys,
}: {
  isOpen: boolean;
  onClose: () => void;
  pastJourneys: CompletedJourney[];
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(14, 30, 54, 0.55)',
          backdropFilter: 'blur(3px)',
        }}
        onClick={onClose}
      />

      {/* Slide-up drawer */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: '8%',
          background: '#e8f4f8',
          borderRadius: '24px 24px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 28px 16px',
            borderBottom: '1px solid rgba(26,35,50,0.08)',
            flexShrink: 0,
            background: '#e8f4f8',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: '#1a2332',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Your Past Journeys
            </h2>
            {pastJourneys.length > 0 && (
              <p
                style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}
              >
                {pastJourneys.length} completed journey
                {pastJourneys.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 9999,
              border: '1px solid #d1d5db',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#6b7280',
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px 40px',
          }}
        >
          {pastJourneys.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 80,
                gap: 16,
              }}
            >
              <span style={{ fontSize: 72, lineHeight: 1 }}>🦫</span>
              <p
                style={{
                  fontSize: 17,
                  fontWeight: 900,
                  color: '#1a2332',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                No past journeys yet
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: '#9ca3af',
                  textAlign: 'center',
                  maxWidth: 280,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                No past journeys yet — your adventures will appear here once
                you complete your first journey.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              {pastJourneys.map((journey, index) => (
                <FerryTicketCard
                  key={journey.id}
                  journey={journey}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
