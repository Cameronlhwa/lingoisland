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
  }

  export function useDefault(segment: Segment): Segment;

  /** English part-of-speech tag translator */
  export const enPOSTag: (p: number) => string;
}
