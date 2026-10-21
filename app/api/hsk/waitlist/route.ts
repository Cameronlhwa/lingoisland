import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["onboarding", "upgrade", "pricing"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    source?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const source =
    typeof body?.source === "string" && SOURCES.has(body.source)
      ? body.source
      : "onboarding";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[hsk-waitlist] Supabase admin env vars are not set");
    return NextResponse.json(
      { error: "Could not join the waitlist. Please try again." },
      { status: 500 },
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const joinedAt = new Date().toISOString();
  const { error } = await supabase.from("onboarding_email_captures").upsert(
    {
      email,
      topic: `hsk-3.0-waitlist:${source}`,
      captured_at: joinedAt,
    },
    { onConflict: "email" },
  );

  if (!error) return NextResponse.json({ ok: true });

  const missingTable =
    error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message);
  if (!missingTable) {
    console.error("[hsk-waitlist]", error.message);
    return NextResponse.json(
      { error: "Could not join the waitlist. Please try again." },
      { status: 500 },
    );
  }

  const bucket = "hsk-waitlist";
  const existing = await supabase.storage.getBucket(bucket);
  if (existing.error) {
    const created = await supabase.storage.createBucket(bucket, { public: false });
    if (created.error && !/already exists/i.test(created.error.message)) {
      console.error("[hsk-waitlist]", created.error.message);
      return NextResponse.json(
        { error: "Could not join the waitlist. Please try again." },
        { status: 500 },
      );
    }
  }

  const path = `${email.replace(/[^a-z0-9._+-]/g, "_")}.json`;
  const uploaded = await supabase.storage.from(bucket).upload(
    path,
    JSON.stringify({ email, source, joined_at: joinedAt }),
    { contentType: "application/json", upsert: true },
  );
  if (uploaded.error) {
    console.error("[hsk-waitlist]", uploaded.error.message);
    return NextResponse.json(
      { error: "Could not join the waitlist. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
