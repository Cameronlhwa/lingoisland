import type {MatchPair} from "./types";
export const MAX_QUIZ_CHOICES=6;
/** Limit distractors without removing the word being tested, including late targets. */
export function meaningQuizChoices(pairs:readonly MatchPair[],target:MatchPair):MatchPair[]{
 const unique=Array.from(new Map(pairs.map(pair=>[pair.id,pair])).values());
 const index=Math.max(0,unique.findIndex(pair=>pair.id===target.id));
 const start=Math.min(Math.floor(index/MAX_QUIZ_CHOICES)*MAX_QUIZ_CHOICES,Math.max(0,unique.length-MAX_QUIZ_CHOICES));
 return unique.slice(start,start+MAX_QUIZ_CHOICES);
}
