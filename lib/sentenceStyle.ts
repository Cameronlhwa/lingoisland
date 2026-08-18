export type SentenceStyle = 'casual' | 'professional'

export const SENTENCE_STYLE_OPTIONS: Array<{
  value: SentenceStyle
  label: string
  description: string
}> = [
  {
    value: 'casual',
    label: 'Casual',
    description: 'Everyday chat — friends, social media, daily life',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Workplace, meetings, emails, formal contexts',
  },
]

export function normalizeSentenceStyle(value: unknown): SentenceStyle {
  return value === 'professional' ? 'professional' : 'casual'
}

export function getSentenceStyleDiversityNote(style: SentenceStyle): string {
  return style === 'professional'
    ? 'Keep examples polished and workplace-appropriate.'
    : 'Keep it casual and native for 20s speakers.'
}

export function getSentenceStyleToneBlock(
  style: SentenceStyle,
  sentenceTierMode: 'full' | 'easy_same' = 'full',
): string {
  if (style === 'professional') {
    return sentenceTierMode === 'easy_same'
      ? `CRITICAL: All example sentences must sound PROFESSIONAL and WORKPLACE-APPROPRIATE — what someone would say or write in a job, client meeting, or business email. Think:
- Polished but natural Mandarin (not stiff textbook prose)
- Respectful register: 您, 贵公司, 请问, 麻烦您 where appropriate
- Clear, concise business communication
- Meeting updates, emails, presentations, client calls
- Avoid slang, memes, and overly intimate friend-to-friend chat`
      : `CRITICAL: All example sentences must sound PROFESSIONAL and WORKPLACE-APPROPRIATE — what someone would say or write in a job, client meeting, or business email. Think:
- Polished but natural Mandarin (not stiff textbook prose)
- Respectful register: 您, 贵公司, 请问, 麻烦您 where appropriate
- Clear, concise business communication
- Meeting updates, emails, presentations, client calls
- Avoid slang, memes, and overly intimate friend-to-friend chat`
  }

  return sentenceTierMode === 'easy_same'
    ? `CRITICAL: All example sentences must be CONVERSATIONAL and CASUAL - exactly what a 20-30 year old person would say to their friend in everyday situations. Think:
- Natural, relaxed speech patterns
- Friendly, informal tone
- How people actually talk, not textbook examples
- Avoid formal or academic language
- Use contractions, casual expressions, and natural flow
- Sound like chatting with a close friend, not giving a presentation`
    : `CRITICAL: All example sentences must be CONVERSATIONAL and CASUAL - exactly what a 20-30 year old person would say to their friend in everyday situations. Think:
- Natural, relaxed speech patterns
- Friendly, informal tone
- How people actually talk, not textbook examples
- Avoid formal or academic language
- Use contractions, casual expressions, and natural flow
- Sound like chatting with a close friend, not giving a presentation`
}

export function getSentenceStyleRequirements(style: SentenceStyle): string {
  if (style === 'professional') {
    return `- Write sentences as if in a workplace: colleagues, clients, or professional settings
- Use polished connectors where natural: 因此、此外、关于、根据、目前、建议
- Avoid slang and meme language
- Keep tone respectful and clear`
  }

  return `- Write sentences as if texting or talking to a friend - casual, conversational, authentic
- Use casual connectors where natural: 其实、感觉、有点、挺、就、真的、太…了、别…了
- Recommended slang examples — you can also use similar expressions not in the list (e.g., 离谱、摆烂、上头、真香). Use only when they fit naturally; do not use them all the time. At most 1 slang word total per word; most sentences should be natural without slang.`
}
