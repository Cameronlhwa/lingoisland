#!/usr/bin/env python3
"""Parse New HSK vocabulary PDFs and write data/hsk-vocabulary-3.0.json.

Usage:
  pip install pdfplumber
  python scripts/import_hsk_vocabulary.py \
    --pdf-dir "/path/to/HSK Word Data"
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import unicodedata
from pathlib import Path

import pdfplumber

COL_STD = {"no": 70, "hanzi": 150, "pinyin": 260, "pos": 370}
COL_ADV = {"no": 70, "hanzi": 220, "pinyin": 370, "pos": 9999}
POS_EN_RE = re.compile(
    r"^(verb|noun|number|adjective|adverb|auxiliary|classifier|conjunction|"
    r"preposition|interjection|pronoun|suffix|prefix|particle|number-classifier)\b",
    re.I,
)
FOOTER_RE = re.compile(r"\s*(Page\s+\d+|Level\s+\d+(?:\s*-\s*9)?).*$", re.I)
SURNAME_RE = re.compile(r"^(surname\b|variant of\b|see [^\s]+\[)", re.I)


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
        definitions = cedict.get(word["hanzi"])
        if not definitions:
            continue
        english = pick_cedict_definition(definitions)
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
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or None


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


def bucket(words: list[dict], cuts: dict[str, int]) -> dict[str, str]:
    cols = {key: [] for key in ["no", "hanzi", "pinyin", "pos", "english"]}
    bounds = [
        ("no", 0, cuts["no"]),
        ("hanzi", cuts["no"], cuts["hanzi"]),
        ("pinyin", cuts["hanzi"], cuts["pinyin"]),
        ("pos", cuts["pinyin"], cuts["pos"]),
        ("english", cuts["pos"], 9999),
    ]
    for word in sorted(words, key=lambda w: w["x0"]):
        x = word["x0"]
        for name, lo, hi in bounds:
            if lo <= x < hi:
                cols[name].append(word["text"])
                break
    return {key: " ".join(value).strip() for key, value in cols.items()}


def is_vocab_page(page: pdfplumber.page.Page) -> bool:
    words = page.extract_words(x_tolerance=1, y_tolerance=3)
    return any(word["x0"] < 70 and word["text"].isdigit() for word in words)


def parse_pdf(path: Path, level: int, fmt: str) -> list[dict]:
    cuts = COL_ADV if fmt == "adv" else COL_STD
    entries: list[dict] = []
    current: dict | None = None

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            if not is_vocab_page(page):
                continue
            words = page.extract_words(x_tolerance=1, y_tolerance=3)
            for cluster in cluster_lines(words):
                cols = bucket(cluster, cuts)
                no_text = cols["no"].strip()
                if no_text.isdigit():
                    if current:
                        entries.append(current)
                    current = {
                        "sort_order": int(no_text),
                        "hanzi": normalize_hanzi(cols["hanzi"]),
                        "pinyin": cols["pinyin"],
                        "part_of_speech": cols["pos"] or None,
                        "english": cols["english"] or None,
                        "level": level,
                        "level_band": "7-9" if level == 7 and fmt == "adv" else None,
                        "standard": "3.0",
                    }
                elif current:
                    for field, key in [
                        ("english", "english"),
                        ("pos", "pos"),
                        ("pinyin", "pinyin"),
                        ("hanzi", "hanzi"),
                    ]:
                        val = cols[key]
                        if not val:
                            continue
                        if field == "hanzi" and not current["hanzi"]:
                            current["hanzi"] = normalize_hanzi(val)
                        elif field == "pinyin" and val and not current["pinyin"]:
                            current["pinyin"] = val
                        elif field == "pos" and val:
                            current["part_of_speech"] = " ".join(
                                part
                                for part in [current.get("part_of_speech"), val]
                                if part
                            )
                        elif field == "english" and val:
                            current["english"] = " ".join(
                                part
                                for part in [current.get("english"), val]
                                if part
                            )
        if current:
            entries.append(current)

    for entry in entries:
        if fmt == "en" and entry.get("part_of_speech"):
            match = POS_EN_RE.match(entry["part_of_speech"])
            if match:
                rest = entry["part_of_speech"][match.end() :].strip(" ,;")
                if rest and not entry["english"]:
                    entry["english"] = rest
                entry["part_of_speech"] = match.group(1).lower()
            elif not entry["english"]:
                entry["english"] = entry["part_of_speech"]
                entry["part_of_speech"] = None
        if fmt == "cn":
            english = entry.get("english") or ""
            match = re.search(r"\s([名动形副代数量介连助叹拟成、（）()]+)$", english)
            if match:
                entry["part_of_speech"] = (entry.get("part_of_speech") or "") + match.group(1)
                entry["english"] = english[: match.start()].strip()
        if fmt == "adv" and entry.get("english") and not entry.get("part_of_speech"):
            entry["part_of_speech"] = entry["english"]
            entry["english"] = None

        entry["hanzi"] = normalize_hanzi(entry.get("hanzi") or "")
        entry["pinyin"] = clean_field(entry.get("pinyin"))
        entry["part_of_speech"] = clean_field(entry.get("part_of_speech"))
        entry["english"] = clean_field(entry.get("english"))

    return entries


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--pdf-dir",
        default="/Users/cameronlhwa/Documents/Lingoisland/HSK Word Data",
        help="Directory containing the New HSK vocabulary PDF files",
    )
    parser.add_argument(
        "--output",
        default="data/hsk-vocabulary-3.0.json",
        help="Output JSON path relative to repo root",
    )
    parser.add_argument(
        "--cedict",
        default="/tmp/cedict.txt.gz",
        help="Optional CC-CEDICT file (.txt or .txt.gz) to fill missing English",
    )
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    repo_root = Path(__file__).resolve().parents[1]
    output_path = repo_root / args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    all_words: list[dict] = []
    specs = [
        (1, "en", "New-HSK-Vocabulary-Level-1.pdf", 300),
        (2, "en", "New-HSK-Vocabulary-Level-2.pdf", 200),
        (3, "en", "New-HSK-Vocabulary-Level-3.pdf", 500),
        (4, "en", "New-HSK-Vocabulary-Level-4.pdf", 1000),
        (5, "en", "New-HSK-Vocabulary-Level-5.pdf", 1600),
        (6, "cn", "New-HSK-Vocabulary-Level-6.pdf", 1800),
        (7, "adv", "New-HSK-Vocabulary-Level-7-9.pdf", 5600),
    ]

    for level, fmt, filename, expected in specs:
        path = pdf_dir / filename
        if not path.exists():
            raise FileNotFoundError(path)
        words = parse_pdf(path, level, fmt)
        print(f"Level {level}: parsed {len(words)} (expected {expected})")
        if len(words) != expected:
            nums = {word["sort_order"] for word in words}
            missing = [i for i in range(1, expected + 1) if i not in nums]
            print(f"  missing {len(missing)} entries, sample: {missing[:10]}")
        all_words.extend(words)

    cedict = load_cedict(Path(args.cedict))
    if cedict:
        filled = enrich_missing_english(all_words, cedict)
        print(f"Filled {filled} missing English definitions from CC-CEDICT")
    else:
        print("No CC-CEDICT file found; level 7-9 words may lack English")

    payload = {
        "standard": "3.0",
        "source": "MandarinBean New HSK Vocabulary PDFs",
        "count": len(all_words),
        "words": all_words,
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(all_words)} words to {output_path}")


if __name__ == "__main__":
    main()
