import { NextResponse } from "next/server";
import { pinyin } from "pinyin-pro";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const result = pinyin(text, {
      toneType: "symbol",
      type: "array",
      nonZh: "consecutive",
    });

    const output = Array.isArray(result) ? result.join(" ") : String(result);

    return NextResponse.json({ pinyin: output });
  } catch (error) {
    console.error("Error in POST /api/pinyin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

