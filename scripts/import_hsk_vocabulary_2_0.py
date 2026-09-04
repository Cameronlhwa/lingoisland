#!/usr/bin/env python3
"""Parse HSK 2.0 vocabulary PDFs and write data/hsk-vocabulary-2.0.json.

The JSON shape matches data/hsk-vocabulary-3.0.json so the same seeder can
load both syllabi into hsk_words.

Usage:
  pip install pdfplumber
  python scripts/import_hsk_vocabulary_2_0.py \
    --pdf-dir "/Users/cameronlhwa/Documents/Lingoisland/HSK Word Data/HSK 2.0 Word Data"

HSK 1–5 are parsed from MandarinBean PDFs (No. / Chinese / Pinyin / English).
HSK 6 is parsed from HSK-6-Vocabulary.pdf when present; otherwise the same
publisher's HSK 6 HTML table is used as a fallback (that PDF is missing from
the source folder).
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

import pdfplumber

HSK6_FALLBACK_URL = "https://mandarinbean.com/hsk-6-vocabulary-list/"

COL_HEADERS = {
    "no": "no",
    "no.": "no",
    "chinese": "hanzi",
    "pinyin": "pinyin",
    "english": "english",
}

POS_FROM_CATEGORY = {
    "personal pron.": "pronoun",
    "demonstrative pron.": "pronoun",
    "interrogative pron.": "pronoun",
    "pronoun": "pronoun",
    "numberal": "number",
    "numeral": "number",
    "number": "number",
    "measure": "classifier",
    "classifier": "classifier",
    "adverb": "adverb",
    "verb": "verb",
    "adjective": "adjective",
    "noun": "noun",
    "auxiliary": "auxiliary",
    "preposition": "preposition",
    "conjunction": "conjunction",
    "particle": "particle",
    "interjection": "interjection",
}

CATEGORY_RE = re.compile(
    r"^(Personal|Demonstrative|Interrogative|Numberal|Numeral|Measure|"
    r"Adverb|Verb|Adjective|Noun|Auxiliary|Preposition|Conjunction|"
    r"Particle|Pronoun|Classifier|Interjection|Quantifier)\b",
    re.I,
)

FOOTER_RE = re.compile(r"\s*(Page\s+\d+|Level\s+\d+).*$", re.I)
SURNAME_RE = re.compile(r"^(surname\b|variant of\b|see [^\s]+\[)", re.I)
PINYIN_GLUE = re.compile(
    r"^(?P<hanzi>[\u3400-\u9fff\uF900-\uFAFF（）()\[\]·、…\.]+)"
    r"(?P<pinyin>[A-Za-zāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜüÜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ].*)$"
)
MD_ROW_RE = re.compile(
    r"^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?\s*$"
)
TAG_RE = re.compile(r"<[^>]+>")

# Particles whose English is often a wrapped header, not a gloss.
FALLBACK_ENGLISH = {
    "的": "structural particle",
    "了": "aspect particle",
    "吗": "question particle",
    "呢": "question particle",
    "吧": "modal particle",
    "得": "structural particle (complement)",
    "着": "aspect particle",
    "过": "experiential aspect particle",
    "地": "adverbial particle",
    "乙": "second Heavenly Stem",
    "丙": "third Heavenly Stem",
    "丁": "fourth Heavenly Stem",
    "嘿": "hey",
    "啦": "modal particle",
    "嘛": "modal particle",
}


def load_cedict(path: Path) -> dict[str, list[str]]:
    entries: dict[str, list[str]] = {}
    if not path.exists():
        return entries
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as handle:  # type: ignore[arg-type]
        for line in handle:
            if line.startswith("#") or not line.strip():
                continue
            match = re.match(r"^(\S+)\s+(\S+)\s+\[(.+?)\]\s+/(.+)/$", line)
            if not match:
                continue
            _, simplified, _, definitions = match.groups()
            defs = [part.strip() for part in definitions.split("/") if part.strip()]
            entries.setdefault(simplified, defs)
    return entries


def pick_cedict_definition(definitions: list[str]) -> str | None:
    for definition in definitions:
        if definition and not SURNAME_RE.match(definition):
            return definition.split(";")[0].strip()
    return definitions[0].split(";")[0].strip() if definitions else None


def enrich_missing_english(words: list[dict], cedict: dict[str, list[str]]) -> int:
    filled = 0
    for word in words:
        if word.get("english"):
            continue
        english = FALLBACK_ENGLISH.get(word["hanzi"])
        if not english:
            definitions = cedict.get(word["hanzi"])
            english = pick_cedict_definition(definitions) if definitions else None
        if english:
            word["english"] = english
            filled += 1
    return filled


def normalize_hanzi(value: str) -> str:
    return unicodedata.normalize("NFKC", value).replace(" ", "")


def clean_field(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = FOOTER_RE.sub("", value.strip())
    cleaned = TAG_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = cleaned.replace("......", "……").replace("...", "…")
    return cleaned or None


def split_glued(hanzi: str, pinyin: str | None) -> tuple[str, str | None]:
    hanzi = normalize_hanzi(hanzi or "")
    if pinyin:
        return hanzi, pinyin
    match = PINYIN_GLUE.match(hanzi)
    if match:
        return match.group("hanzi"), match.group("pinyin")
    return hanzi, pinyin


def cluster_lines(words: list[dict], y_tol: float = 3) -> list[list[dict]]:
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: w["top"])
    clusters: list[list[dict]] = [[sorted_words[0]]]
    for word in sorted_words[1:]:
        if abs(word["top"] - clusters[-1][0]["top"]) <= y_tol:
            clusters[-1].append(word)
        else:
            clusters.append([word])
    return clusters


def detect_cuts(page: pdfplumber.page.Page) -> dict[str, float] | None:
    words = page.extract_words(x_tolerance=1, y_tolerance=3)
    headers: dict[str, float] = {}
    for word in words:
        key = COL_HEADERS.get(word["text"].strip().lower().rstrip("."))
        if key and key not in headers:
            headers[key] = word["x0"]
    if not {"no", "hanzi", "pinyin", "english"} <= headers.keys():
        return None
    return {
        "no": (headers["no"] + headers["hanzi"]) / 2,
        "hanzi": (headers["hanzi"] + headers["pinyin"]) / 2,
        "pinyin": (headers["pinyin"] + headers["english"]) / 2,
    }


def bucket(words: list[dict], cuts: dict[str, float]) -> dict[str, str]:
    cols: dict[str, list[str]] = {key: [] for key in ["no", "hanzi", "pinyin", "english"]}
    bounds = [
        ("no", 0.0, cuts["no"]),
        ("hanzi", cuts["no"], cuts["hanzi"]),
        ("pinyin", cuts["hanzi"], cuts["pinyin"]),
        ("english", cuts["pinyin"], 9999.0),
    ]
    for word in sorted(words, key=lambda w: w["x0"]):
        x = word["x0"]
        for name, lo, hi in bounds:
            if lo <= x < hi:
                cols[name].append(word["text"])
                break
    return {key: " ".join(value).strip() for key, value in cols.items()}


def map_part_of_speech(category: str | None) -> str | None:
    if not category:
        return None
    return POS_FROM_CATEGORY.get(category.strip().lower())


def parse_pdf(path: Path, level: int, y_tol: float) -> list[dict]:
    entries: list[dict] = []
    current: dict | None = None
    category: str | None = None
    cuts: dict[str, float] | None = None

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_cuts = detect_cuts(page)
            if page_cuts:
                cuts = page_cuts
            if not cuts:
                continue
            words = page.extract_words(x_tolerance=1, y_tolerance=y_tol)
            for cluster in cluster_lines(words, y_tol=y_tol):
                cols = bucket(cluster, cuts)
                no_text = cols["no"].strip().rstrip(".")
                joined = " ".join(
                    word["text"] for word in sorted(cluster, key=lambda w: w["x0"])
                ).strip()
                low = joined.lower()
                if low.startswith("no") and "chinese" in low:
                    continue
                if re.fullmatch(r"\d+", joined):
                    continue
                if no_text.isdigit():
                    if current:
                        entries.append(current)
                    hanzi, pinyin = split_glued(cols["hanzi"], cols["pinyin"] or None)
                    current = {
                        "sort_order": int(no_text),
                        "hanzi": hanzi,
                        "pinyin": pinyin,
                        "part_of_speech": map_part_of_speech(category),
                        "english": cols["english"] or None,
                        "level": level,
                        "level_band": None,
                        "standard": "2.0",
                    }
                    continue
                if CATEGORY_RE.match(joined) and not cols["pinyin"]:
                    category = joined
                    continue
                if current:
                    if cols["english"]:
                        current["english"] = " ".join(
                            part for part in [current.get("english"), cols["english"]] if part
                        )
                    if cols["pinyin"] and not current.get("pinyin"):
                        current["pinyin"] = cols["pinyin"]
                    if cols["hanzi"] and not current.get("hanzi"):
                        current["hanzi"] = normalize_hanzi(cols["hanzi"])

        if current:
            entries.append(current)

    for entry in entries:
        hanzi, pinyin = split_glued(entry.get("hanzi") or "", entry.get("pinyin"))
        entry["hanzi"] = hanzi
        entry["pinyin"] = clean_field(pinyin)
        entry["part_of_speech"] = clean_field(entry.get("part_of_speech"))
        entry["english"] = clean_field(entry.get("english"))

    return entries


def parse_pdf_best(path: Path, level: int, expected: int) -> list[dict]:
    best: list[dict] = []
    for y_tol in (3.0, 2.0, 1.5, 4.0):
        words = parse_pdf(path, level, y_tol)
        if len(words) == expected:
            return words
        if abs(len(words) - expected) < abs(len(best) - expected):
            best = words
    return best


def parse_markdown_table(text: str, level: int) -> list[dict]:
    entries: list[dict] = []
    for line in text.splitlines():
        match = MD_ROW_RE.match(line.strip())
        if not match:
            continue
        sort_order, hanzi, pinyin, english = match.groups()
        if hanzi.strip().lower() in {"chinese", "word"}:
            continue
        entries.append(
            {
                "sort_order": int(sort_order),
                "hanzi": normalize_hanzi(hanzi),
                "pinyin": clean_field(pinyin),
                "part_of_speech": None,
                "english": clean_field(english),
                "level": level,
                "level_band": None,
                "standard": "2.0",
            }
        )
    return entries


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._in_cell = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._cell = []
            self._in_cell = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._row is not None and self._cell is not None:
            self._row.append(re.sub(r"\s+", " ", "".join(self._cell)).strip())
            self._cell = None
            self._in_cell = False
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._in_cell and self._cell is not None:
            self._cell.append(data)


def parse_html_table(html: str, level: int) -> list[dict]:
    parser = _TableParser()
    parser.feed(html)
    entries: list[dict] = []
    for row in parser.rows:
        if len(row) < 4:
            continue
        no_text, hanzi, pinyin, english = row[0], row[1], row[2], row[3]
        if not no_text.isdigit():
            continue
        entries.append(
            {
                "sort_order": int(no_text),
                "hanzi": normalize_hanzi(hanzi),
                "pinyin": clean_field(pinyin),
                "part_of_speech": None,
                "english": clean_field(english),
                "level": level,
                "level_band": None,
                "standard": "2.0",
            }
        )
    return entries


def fetch_url(url: str) -> str:
    request = Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LingoIslandImporter/1.0)"},
    )
    with urlopen(request, timeout=60) as response:  # noqa: S310
        return response.read().decode("utf-8", errors="replace")


def load_level_six(pdf_dir: Path, fallback_path: Path | None) -> list[dict]:
    pdf_path = pdf_dir / "HSK-6-Vocabulary.pdf"
    if pdf_path.exists():
        return parse_pdf_best(pdf_path, 6, 2500)

    candidates = [
        fallback_path,
        pdf_dir / "HSK-6-Vocabulary.md",
        pdf_dir / "HSK-6-Vocabulary.html",
    ]
    for path in candidates:
        if path and path.exists():
            text = path.read_text(encoding="utf-8")
            words = parse_html_table(text, 6) or parse_markdown_table(text, 6)
            if words:
                print(f"Level 6: loaded {len(words)} from {path}")
                return words

    print(f"Level 6 PDF missing; fetching {HSK6_FALLBACK_URL}")
    html = fetch_url(HSK6_FALLBACK_URL)
    words = parse_html_table(html, 6) or parse_markdown_table(html, 6)
    return words


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pdf-dir",
        default="/Users/cameronlhwa/Documents/Lingoisland/HSK Word Data/HSK 2.0 Word Data",
        help="Directory containing HSK-1-Vocabulary.pdf … HSK-6-Vocabulary.pdf",
    )
    parser.add_argument(
        "--output",
        default="data/hsk-vocabulary-2.0.json",
        help="Output JSON path relative to repo root",
    )
    parser.add_argument(
        "--cedict",
        default="/tmp/cedict.txt.gz",
        help="Optional CC-CEDICT file (.txt or .txt.gz) to fill missing English",
    )
    parser.add_argument(
        "--hsk6-source",
        default=None,
        help="Optional HTML/Markdown table for HSK 6 when the PDF is missing",
    )
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    repo_root = Path(__file__).resolve().parents[1]
    output_path = repo_root / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    all_words: list[dict] = []
    specs = [
        (1, "HSK-1-Vocabulary.pdf", 150),
        (2, "HSK-2-Vocabulary.pdf", 150),
        (3, "HSK-3-Vocabulary.pdf", 300),
        (4, "HSK-4-Vocabulary.pdf", 600),
        (5, "HSK-5-Vocabulary.pdf", 1300),
    ]

    for level, filename, expected in specs:
        path = pdf_dir / filename
        if not path.exists():
            raise FileNotFoundError(path)
        words = parse_pdf_best(path, level, expected)
        nums = {word["sort_order"] for word in words}
        missing = [i for i in range(1, expected + 1) if i not in nums]
        print(f"Level {level}: parsed {len(words)} (expected {expected})")
        if missing:
            print(f"  missing {len(missing)} entries, sample: {missing[:10]}")
        all_words.extend(words)

    fallback = Path(args.hsk6_source) if args.hsk6_source else None
    level_six = load_level_six(pdf_dir, fallback)
    print(f"Level 6: parsed {len(level_six)} (expected 2500)")
    if len(level_six) != 2500:
        nums = {word["sort_order"] for word in level_six}
        missing = [i for i in range(1, 2501) if i not in nums]
        print(f"  missing {len(missing)} entries, sample: {missing[:10]}")
    all_words.extend(level_six)

    cedict = load_cedict(Path(args.cedict))
    filled = enrich_missing_english(all_words, cedict)
    print(f"Filled {filled} missing English definitions")

    payload = {
        "standard": "2.0",
        "source": "MandarinBean HSK 2.0 Vocabulary PDFs (HSK 6 HTML fallback)",
        "count": len(all_words),
        "words": all_words,
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(all_words)} words to {output_path}")


if __name__ == "__main__":
    main()
