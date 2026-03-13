declare module "segmentit" {
  export interface SegmentToken {
    /** Word text */
    w: string;
    /** Part-of-speech bitmask */
    p: number;
  }

  export interface SegmentOptions {
    /** Return an array of word strings instead of token objects */
    simple?: boolean;
  }

  export class Segment {
    doSegment(text: string, options?: SegmentOptions & { simple: false }): SegmentToken[];
    doSegment(text: string, options: SegmentOptions & { simple: true }): string[];
    doSegment(text: string, options?: SegmentOptions): SegmentToken[] | string[];
    /** Load a newline-delimited custom dictionary string (word|POS|frequency) */
    loadDict(dict: string | string[]): this;
    /** Load a newline-delimited synonym dictionary string (word1,word2) */
    loadSynonymDict(dict: string | string[]): this;
    /** Attach tokenizer/optimizer modules */
    use(modules: unknown[]): this;
  }

  export function useDefault(segment: Segment): Segment;

  /** English part-of-speech tag translator */
  export const enPOSTag: (p: number) => string;
}
