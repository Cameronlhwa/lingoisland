/**
 * Journey roadmap placement.
 *
 * The background is public/journey/journey-ocean-background.png (1024×416),
 * the same proportion as 1966/800. Island coordinates are percentages of that
 * image so they scale with it.
 */

export const OCEAN_WIDTH = 1024;
export const OCEAN_HEIGHT = 416;
export const OCEAN_SRC = "/journey/journey-ocean-background.png";

export const SOURCE_W = 1448;
export const SOURCE_H = 1086;

// x/y are percentages relative to the journey background image.
// Adjust these values to reposition islands without changing layout CSS.
export const JOURNEY_ISLAND_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 13, y: 26 },
  2: { x: 38, y: 26 },
  3: { x: 62, y: 26 },
  4: { x: 86, y: 26 },
  5: { x: 25, y: 68 },
  6: { x: 49, y: 68 },
  7: { x: 70, y: 68 },
};

/** Visible island width as a percentage of the roadmap width. */
export const JOURNEY_ISLAND_WIDTHS: Record<number, number> = {
  1: 17,
  2: 17,
  3: 17,
  4: 18,
  5: 17,
  6: 17,
  7: 17,
};

export type ArtworkId =
  | "gazebo-lounge"
  | "study-cottage"
  | "bank"
  | "teaching-board"
  | "observatory"
  | "library"
  | "grand-library";

export type JourneyMapNodeType = "island" | "story" | "tone_practice";

export type JourneyMapNode = {
  id: string;
  type: JourneyMapNodeType;
};

/** Opaque pixel bounds of each transparent illustration (source 1448×1086). */
export const ART_PIXELS: Record<ArtworkId, { l: number; t: number; r: number; b: number }> = {
  "gazebo-lounge": { l: 55, t: 32, r: 1403, b: 1016 },
  "study-cottage": { l: 107, t: 34, r: 1350, b: 983 },
  bank: { l: 58, t: 81, r: 1395, b: 1030 },
  "teaching-board": { l: 61, t: 67, r: 1399, b: 1003 },
  observatory: { l: 144, t: 83, r: 1380, b: 1027 },
  library: { l: 91, t: 72, r: 1358, b: 1016 },
  "grand-library": { l: 77, t: 112, r: 1399, b: 988 },
};

const TOPIC_ARTWORK: ArtworkId[] = [
  "gazebo-lounge",
  "study-cottage",
  "bank",
  "teaching-board",
  "observatory",
];

const STORY_ARTWORK: ArtworkId[] = ["library", "grand-library"];

export function artworkSrc(id: ArtworkId) {
  return `/journey/journey-island-${id}.png`;
}

export function visibleArtSize(art: ArtworkId) {
  const pixels = ART_PIXELS[art];
  return { width: pixels.r - pixels.l, height: pixels.b - pixels.t };
}

export function assignArtwork(nodes: readonly JourneyMapNode[]) {
  const assigned = new Map<string, ArtworkId>();
  let islandIndex = 0;
  let storyIndex = 0;
  for (const node of nodes) {
    if (node.type === "island") {
      assigned.set(node.id, TOPIC_ARTWORK[islandIndex % TOPIC_ARTWORK.length]);
      islandIndex += 1;
    } else if (node.type === "story") {
      assigned.set(node.id, STORY_ARTWORK[storyIndex % STORY_ARTWORK.length]);
      storyIndex += 1;
    }
  }
  return assigned;
}

export function journeyIslandPosition(slot: number) {
  return (
    JOURNEY_ISLAND_POSITIONS[slot] ?? {
      x: 12 + ((Math.max(slot, 1) - 1) % 4) * 22,
      y: slot > 7 ? 88 : 50,
    }
  );
}

export function journeyIslandWidth(slot: number) {
  return JOURNEY_ISLAND_WIDTHS[slot] ?? 17;
}

type Point = { x: number; y: number };

function segment(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) < 12) {
    const lift = from.y < 50 ? -2.4 : 2.6;
    return `C ${from.x + dx * 0.45} ${from.y + lift}, ${from.x + dx * 0.55} ${to.y + lift}, ${to.x} ${to.y}`;
  }
  return `C ${from.x + dx * 0.12} ${from.y + dy * 0.62}, ${to.x - dx * 0.08} ${to.y - dy * 0.28}, ${to.x} ${to.y}`;
}

function segmentControls(from: Point, to: Point): [Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) < 12) {
    const lift = from.y < 50 ? -2.4 : 2.6;
    return [
      { x: from.x + dx * 0.45, y: from.y + lift },
      { x: from.x + dx * 0.55, y: to.y + lift },
    ];
  }
  return [
    { x: from.x + dx * 0.12, y: from.y + dy * 0.62 },
    { x: to.x - dx * 0.08, y: to.y - dy * 0.28 },
  ];
}

/** Dotted route through the illustrated islands that actually exist. */
export function journeyRoutePath(slotCount: number) {
  const count = Math.min(7, Math.max(0, slotCount));
  if (count < 2) return "";
  const points = Array.from({ length: count }, (_, index) => journeyIslandPosition(index + 1));
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    path += ` ${segment(points[index], points[index + 1])}`;
  }
  return path;
}

function cubicPoint(from: Point, c1: Point, c2: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
    y: u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
  };
}

function boxesOverlap(
  a: { l: number; r: number; t: number; b: number },
  b: { l: number; r: number; t: number; b: number },
) {
  return a.r > b.l && a.l < b.r && a.b > b.t && a.t < b.b;
}

function markerClearsIslands(point: Point, slots: number[]) {
  // 3.6% of map width. Height is converted because the map is much wider than it is tall.
  const halfW = 2.2;
  const halfH = halfW * (OCEAN_WIDTH / OCEAN_HEIGHT);
  const marker = {
    l: point.x - halfW,
    r: point.x + halfW,
    t: point.y - halfH,
    b: point.y + halfH,
  };
  return slots.every((slot) => {
    const anchor = journeyIslandPosition(slot);
    const width = journeyIslandWidth(slot);
    const height = (width * (OCEAN_WIDTH / OCEAN_HEIGHT)) / 1.37;
    const art = {
      l: anchor.x - width / 2 - 0.8,
      r: anchor.x + width / 2 + 0.8,
      t: anchor.y - height / 2 - 0.8,
      b: anchor.y + height / 2 + 0.4,
    };
    const labelHalf = (width * 1.18) / 2 + 1.2;
    const label = {
      l: anchor.x - labelHalf,
      r: anchor.x + labelHalf,
      t: anchor.y + height / 2,
      b: anchor.y + height / 2 + 12,
    };
    return !boxesOverlap(marker, art) && !boxesOverlap(marker, label);
  });
}

/**
 * A pronunciation marker sits on the route only when that point is in open
 * water. Returns null when every candidate would cover an island or label.
 */
export function journeyConnectorPoint(
  prevSlot: number | null,
  nextSlot: number | null,
  occupiedSlots: number[],
): Point | null {
  if (!prevSlot || !nextSlot) return null;
  const from = journeyIslandPosition(prevSlot);
  const to = journeyIslandPosition(nextSlot);
  const [c1, c2] = segmentControls(from, to);
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (let step = 1; step <= 7; step += 1) {
    const t = step / 8;
    const point = cubicPoint(from, c1, c2, to, t);
    if (point.x < 4 || point.x > 96 || point.y < 6 || point.y > 92) continue;
    if (!markerClearsIslands(point, occupiedSlots)) continue;
    const distance = Math.abs(t - 0.5);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return best;
}
