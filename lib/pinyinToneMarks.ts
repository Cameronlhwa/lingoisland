const TONE: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  v: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

function applyTone(syllable: string, tone: number): string {
  const s = syllable.toLowerCase();
  const mark = (v: string) => TONE[v][tone - 1];

  if (s.includes("a")) return s.replace("a", mark("a")).replace(/v/g, "ü");
  if (s.includes("e")) return s.replace("e", mark("e")).replace(/v/g, "ü");
  if (s.includes("ou")) return s.replace("o", mark("o")).replace(/v/g, "ü");
  if (s.includes("v")) return s.replace("v", mark("v"));
  for (const v of ["u", "i", "o"]) {
    const idx = s.lastIndexOf(v);
    if (idx >= 0) {
      return (s.slice(0, idx) + mark(v) + s.slice(idx + 1)).replace(/v/g, "ü");
    }
  }
  return s.replace(/v/g, "ü");
}

/** CC-CEDICT numbered pinyin ("ni3 hao3") → tone marks ("nǐ hǎo"). */
export function toneMarks(pinyin: string): string {
  const clean = pinyin
    .replace(/\([^)]*\)/g, "")
    .split("/")[0]
    .trim();

  return clean
    .split(" ")
    .map((syl) => {
      const m = syl.match(/^([a-züA-ZÜ:]+)(\d)$/);
      if (!m) return syl.replace(/v/g, "ü");
      const tone = parseInt(m[2], 10);
      return tone === 5 ? m[1].replace(/v/g, "ü") : applyTone(m[1], tone);
    })
    .join(" ");
}
