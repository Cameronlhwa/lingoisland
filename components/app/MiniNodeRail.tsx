import { BookMarked, Check } from 'lucide-react';

export type MiniJourneyIsland = {
  id: string;
  position: number;
  /** Accept both column name variants from the codebase */
  node_type?: 'island' | 'story';
  type?: 'island' | 'story';
  completed_at?: string | null;
  /** Pre-resolved boolean also accepted (from PathNode) */
  completed?: boolean;
  word_count?: number | null;
  wordCount?: number;
  emoji?: string;
  hint?: string;
};

export function MiniNodeRail({ nodes }: { nodes: MiniJourneyIsland[] }) {
  return (
    <div className="flex items-center w-full">
      {nodes.map((node, i) => {
        const isStory = (node.node_type ?? node.type) === 'story';
        const isDone = node.completed ?? !!node.completed_at;
        const isConnectorDone =
          isDone && i < nodes.length - 1 && !!(nodes[i + 1]?.completed ?? !!nodes[i + 1]?.completed_at);

        return (
          <div key={node.id} className="flex items-center flex-1 min-w-0">
            <div className="flex-1 flex justify-center">
              {isStory ? (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: isDone ? '#fbbf24' : '#f3f4f6',
                    border: `1.5px solid ${isDone ? '#f59e0b' : '#e5e7eb'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookMarked size={7} color={isDone ? 'white' : '#d1d5db'} />
                </div>
              ) : (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: isDone ? '#14b8a6' : '#f3f4f6',
                    border: `1.5px solid ${isDone ? '#0d9488' : '#e5e7eb'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={8} strokeWidth={3} color={isDone ? 'white' : '#d1d5db'} />
                </div>
              )}
            </div>
            {i < nodes.length - 1 && (
              <div
                style={{
                  height: 1,
                  background: isConnectorDone ? '#5eead4' : '#e5e7eb',
                  maxWidth: 16,
                  flex: 1,
                  margin: '0 2px',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
