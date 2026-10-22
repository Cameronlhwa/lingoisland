import { NextResponse } from "next/server";
import {
  buildSentenceBreakdown,
  lookupChineseWordDetailed,
  segmentChineseText,
} from "@/lib/chineseTokenizer";

export const runtime = "nodejs";

const MAX_TEXTS = 200;
const MAX_TEXT_LENGTH = 2000;

function isShortString(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_TEXT_LENGTH;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const action = body?.action;

    if (action === "segment") {
      const texts = body.texts;
      if (
        !Array.isArray(texts) ||
        texts.length > MAX_TEXTS ||
        !texts.every(isShortString)
      ) {
        return NextResponse.json({ error: "Invalid texts" }, { status: 400 });
      }
      const segments = await Promise.all(
        texts.map((text: string) =>
          segmentChineseText(text).then((tokens) =>
            tokens.map(({ w, p }) => ({ w, p })),
          ),
        ),
      );
      return NextResponse.json({ segments });
    }

    if (action === "lookup") {
      if (!isShortString(body.word) || !body.word) {
        return NextResponse.json({ error: "Invalid word" }, { status: 400 });
      }
      const entry = await lookupChineseWordDetailed(body.word);
      return NextResponse.json({ entry });
    }

    if (action === "breakdown") {
      const target = body.target;
      if (
        !isShortString(body.sentence) ||
        !target ||
        !isShortString(target.hanzi) ||
        !isShortString(target.pinyin) ||
        !isShortString(target.english)
      ) {
        return NextResponse.json({ error: "Invalid sentence" }, { status: 400 });
      }
      const tokens = await buildSentenceBreakdown(body.sentence, {
        hanzi: target.hanzi,
        pinyin: target.pinyin,
        english: target.english,
      });
      return NextResponse.json({ tokens });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Error in POST /api/chinese:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
