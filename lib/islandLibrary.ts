/**
 * Island Library Manifest
 * 
 * Pre-generated island images stored in public/island-library/
 * Each island gets a random cover_key assigned once and persisted.
 */

export const ISLAND_LIBRARY_KEYS = [
  'harbin-ice-city-winter-festival.png',
  'modern-china-with-advanced-technology.png',
  'ancient-china.png',
  'tropical-hainan-island.png',
  'singapore-futuristic-city.png',
  'china-with-flying-cars-future-city.png',
  'beijing-traditional-hutong-area.png',
  'shanghai-night-skyline-neon.png',
  'chengdu-panda-city-vibe.png',
  'xian-terracotta-warriors-history.png',
  'guilin-karst-mountains-river-cruise.png',
  'hong-kong.png',
  'tibetan-plateau-mountains-and-prayer-flags.png',
  'silk-road-desert-caravan-vibe.png',
  'chinese-high-speed-rail-travel.png',
  'lantern-festival-night-market.png',
  'traditional-chinese-tea-house.png',
  'dragon-boat-festival.png',
  'snowy-northern-china-ice-town.png',
  'futuristic-shenzhen.png',
] as const

/**
 * Pick a random cover key from the library
 */
export function pickRandomCoverKey(): string {
  const index = Math.floor(Math.random() * ISLAND_LIBRARY_KEYS.length)
  return ISLAND_LIBRARY_KEYS[index]
}

/**
 * Convert cover_key to full URL path
 */
export function coverUrlFromKey(key: string): string {
  return `/island-library/${key}`
}
