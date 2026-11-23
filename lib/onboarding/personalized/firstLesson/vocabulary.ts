import type {MatchPair} from "./types";
export const VOCABULARY_BATCH_SIZE = 3;
/** Keep lesson order, removing only words explicitly marked familiar. */
export function unfamiliarVocabulary(words:MatchPair[],knownIds:readonly string[]) {
 const known=new Set(knownIds);
 return words.filter(word=>!known.has(word.id));
}
export function vocabularyBatch(words:MatchPair[],index:number) {
 const start=Math.floor(Math.max(0,index)/VOCABULARY_BATCH_SIZE)*VOCABULARY_BATCH_SIZE;
 return words.slice(start,start+VOCABULARY_BATCH_SIZE);
}

/** Use one ordered vocabulary list; categories do not create undersized batches. */
export function orderedVocabulary(words:MatchPair[],groups:readonly {wordIds:string[]}[]) {
 const byId=new Map(words.map(word=>[word.id,word]));
 const ids=Array.from(new Set([...groups.flatMap(group=>group.wordIds),...words.map(word=>word.id)]));
 return ids.flatMap(id=>{const word=byId.get(id);return word?[word]:[];});
}

export function groupedVocabularyBatch(words:MatchPair[],groups:readonly {id:string;title:string;wordIds:string[]}[],knownIds:readonly string[],index:number) {
 const ordered=orderedVocabulary(words,groups),known=new Set(knownIds);
 const unknown=unfamiliarVocabulary(ordered,knownIds);
 if(!unknown.length)return null;
 const safeIndex=Math.min(Math.max(0,index),unknown.length-1);
 const batchStart=Math.floor(safeIndex/VOCABULARY_BATCH_SIZE)*VOCABULARY_BATCH_SIZE;
 const batch=vocabularyBatch(unknown,safeIndex);
 // Review only earlier taught words or words explicitly marked familiar.
 const review=[...unknown.slice(0,batchStart).reverse(),...ordered.filter(word=>known.has(word.id))];
 const quizPairs=[...batch,...review.slice(0,VOCABULARY_BATCH_SIZE-batch.length)];
 return {batch,quizPairs,batchStart,round:Math.floor(batchStart/VOCABULARY_BATCH_SIZE)+1,rounds:Math.ceil(unknown.length/VOCABULARY_BATCH_SIZE)};
}
