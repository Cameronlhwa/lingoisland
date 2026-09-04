import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { denyWithoutProductAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denial = await denyWithoutProductAccess(user.id, "hsk");
    if (denial) return denial;

    const { data: test, error: testErr } = await supabase
      .from("practice_tests")
      .select("id, is_free")
      .eq("id", params.id)
      .maybeSingle();
    if (testErr || !test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const entitlements = await getEntitlements(user.id);
    if (!test.is_free && !entitlements.isHskPro) {
      return NextResponse.json(
        { error: "Subscribe to unlock this test", code: "PAYWALL_HSK_TEST" },
        { status: 403 },
      );
    }

    // No real question content yet — record a placeholder attempt so the
    // Not started / Completed / Needs review states are exercisable end-to-end.
    // TODO: replace with real section-by-section scoring once test content exists.
    const percent = Math.floor(55 + Math.random() * 40);

    const { data: attempt, error: insErr } = await supabase
      .from("test_attempts")
      .insert({
        user_id: user.id,
        test_id: test.id,
        percent,
        total_score: percent,
        is_placeholder: true,
      })
      .select("id, percent, completed_at")
      .single();

    if (insErr || !attempt) {
      console.error("[hsk/tests/attempt] insert", insErr);
      return NextResponse.json({ error: "Failed to record attempt" }, { status: 500 });
    }

    return NextResponse.json({ attempt });
  } catch (e) {
    console.error("[hsk/tests/attempt]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
