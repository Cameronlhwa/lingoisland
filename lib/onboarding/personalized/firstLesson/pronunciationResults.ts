export type PronunciationPiece = { hanzi: string; pinyin: string | null; score: number | null; targetTone: number | null };
export function scoreNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
export function parsePronunciationPieces(raw: unknown): PronunciationPiece[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).flatMap(row => {
    if (!row || typeof row !== "object" || typeof row.hanzi !== "string" || !/^[\u3400-\u9fff]{1,20}$/.test(row.hanzi)) return [];
    return [{hanzi:row.hanzi, pinyin:typeof row.pinyin === "string" ? row.pinyin.slice(0,100) : null, score:scoreNumber(row.score), targetTone:[1,2,3,4].includes(row.targetTone) ? row.targetTone : null}];
  });
}
export function alignedPronunciationPieces(text: string, raw: unknown): PronunciationPiece[] {
  const reference = text.replace(/[^\u3400-\u9fff]/g, "");
  const pieces = parsePronunciationPieces(raw);
  // Never assign a score to the wrong character when alignment is uncertain.
  return pieces.length && pieces.map(p => p.hanzi).join("") === reference ? pieces : Array.from(reference).map(hanzi => ({hanzi,pinyin:null,score:null,targetTone:null}));
}
export function pronunciationBand(score: number | null) {
  return score === null ? "unscored" : score >= 80 ? "clear" : score >= 60 ? "close" : "practice";
}
