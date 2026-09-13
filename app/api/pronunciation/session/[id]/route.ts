import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: session, error } = await supabase
    .from("pronunciation_sessions")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ error: "Practice session not found" }, { status: 404 });
  }

  const { data: attempts } = await supabase
    .from("pronunciation_attempts")
    .select("id, unit_type, target_text, attempt_number, overall_score, weak_syllables, created_at")
    .eq("session_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ session, attempts: attempts ?? [] });
}
