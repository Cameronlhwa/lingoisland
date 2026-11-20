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

/** Batches never cross the boundary between shared core words and goal vocabulary. */
export function groupedVocabularyBatch(words:MatchPair[],groups:readonly {id:string;title:string;wordIds:string[]}[],knownIds:readonly string[],index:number) {
 const known=new Set(knownIds);
 let offset=0;
 for(const group of groups){
  const ids=new Set(group.wordIds),unknown=words.filter(w=>ids.has(w.id)&&!known.has(w.id));
  if(index<offset+unknown.length){
   const localIndex=Math.max(0,index-offset),start=Math.floor(localIndex/VOCABULARY_BATCH_SIZE)*VOCABULARY_BATCH_SIZE;
   return {group,batch:unknown.slice(start,start+VOCABULARY_BATCH_SIZE),batchStart:offset+start,round:Math.floor(localIndex/VOCABULARY_BATCH_SIZE)+1,rounds:Math.ceil(unknown.length/VOCABULARY_BATCH_SIZE)};
  }
  offset+=unknown.length;
 }
 return null;
}
