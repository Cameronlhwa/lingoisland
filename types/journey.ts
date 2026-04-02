export type CompletedJourney = {
  id: string;
  title?: string;
  topic: string;
  completed_at: string | null;
  created_at: string;
  user_id: string;
  journey_islands: {
    id: string;
    position: number;
    step_order?: number;
    node_type: 'island' | 'story';
    completed_at: string | null;
    word_count: number | null;
    emoji?: string;
    hint?: string;
  }[];
};
