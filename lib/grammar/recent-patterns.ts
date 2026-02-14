/**
 * Get recently used grammar patterns for a user
 * Used to avoid repetition across islands
 */
import { createClient } from '@/lib/supabase/server'

export async function getRecentGrammarPatterns(
  userId: string,
  limit: number = 10
): Promise<string[]> {
  try {
    const supabase = await createClient()
    
    // Get the last N grammar patterns this user has seen
    // Ordered by most recent first
    const { data, error } = await supabase
      .from('island_grammar_focus')
      .select('hanzi, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.error('Error fetching recent grammar:', error)
      return []
    }
    
    // Return unique hanzi patterns
    const patterns = Array.from(new Set(data?.map(g => g.hanzi) || []))
    return patterns
  } catch (error) {
    console.error('Error in getRecentGrammarPatterns:', error)
    return []
  }
}
