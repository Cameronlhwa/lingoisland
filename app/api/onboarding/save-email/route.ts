import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      topic?: unknown;
    } | null;
    const email =
      typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const topic =
      typeof body?.topic === "string" ? body.topic.trim().slice(0, 200) : null;

    const supabase = await createClient();
    const { error } = await supabase.from("onboarding_email_captures").insert({
      email,
      topic,
      captured_at: new Date().toISOString(),
    });

    if (error && error.code !== "23505") {
      console.error("[save-email]", error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[save-email]", err);
    return NextResponse.json({ ok: true });
  }
}
