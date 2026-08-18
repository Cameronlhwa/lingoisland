import type { SupabaseClient } from '@supabase/supabase-js'

let topicIslandsSentenceStyleColumn: boolean | null = null
let journeysSentenceStyleColumn: boolean | null = null

async function columnExists(
  supabase: SupabaseClient,
  table: 'topic_islands' | 'journeys',
  column: string,
): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(0)
  return !error
}

export async function topicIslandsHasSentenceStyleColumn(
  supabase: SupabaseClient,
): Promise<boolean> {
  if (topicIslandsSentenceStyleColumn !== null) {
    return topicIslandsSentenceStyleColumn
  }
  topicIslandsSentenceStyleColumn = await columnExists(
    supabase,
    'topic_islands',
    'sentence_style',
  )
  return topicIslandsSentenceStyleColumn
}

export async function journeysHasSentenceStyleColumn(
  supabase: SupabaseClient,
): Promise<boolean> {
  if (journeysSentenceStyleColumn !== null) {
    return journeysSentenceStyleColumn
  }
  journeysSentenceStyleColumn = await columnExists(
    supabase,
    'journeys',
    'sentence_style',
  )
  return journeysSentenceStyleColumn
}

/** Call after running DDL so the next request re-probes PostgREST. */
export function resetSentenceStyleColumnCache(): void {
  topicIslandsSentenceStyleColumn = null
  journeysSentenceStyleColumn = null
}
