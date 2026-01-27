import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FeedbackRequest = {
  reason: string;
  details?: string | null;
  comeback?: string | null;
  planAtTime: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | FeedbackRequest
      | null;

    if (!body?.reason || !body?.planAtTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("cancellation_feedback").insert({
      user_id: user.id,
      plan_at_time: body.planAtTime,
      reason: body.reason,
      details: body.details ?? null,
      comeback: body.comeback ?? null,
    });

    if (error) {
      console.error("[CANCELLATION FEEDBACK] Insert failed:", error);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in POST /api/billing/cancellation-feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
