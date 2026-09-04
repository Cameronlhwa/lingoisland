import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { denyWithoutProductAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TestSection = {
  id: string;
  type: "listening" | "reading" | "writing";
  question_count: number;
  time_limit_minutes: number;
};

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const levelParam = url.searchParams.get("level");
    const level = levelParam ? Number(levelParam) : null;

    let query = supabase
      .from("practice_tests")
      .select(
        "id, level, title, is_free, test_sections(id, type, question_count, time_limit_minutes)",
      )
      .order("level", { ascending: true })
      .order("title", { ascending: true });

    if (level) {
      query = query.eq("level", level);
    }

    const { data: tests, error } = await query;
    if (error) {
      console.error("[hsk/tests] query", error);
      return NextResponse.json({ error: "Failed to load tests" }, { status: 500 });
    }

    const testIds = (tests ?? []).map((t) => t.id);
    const latestAttemptByTestId = new Map<
      string,
      { percent: number; completed_at: string }
    >();

    if (testIds.length > 0) {
      const { data: attempts } = await supabase
        .from("test_attempts")
        .select("test_id, percent, completed_at")
        .eq("user_id", user.id)
        .in("test_id", testIds)
        .order("completed_at", { ascending: false });

      for (const a of attempts ?? []) {
        if (!latestAttemptByTestId.has(a.test_id)) {
          latestAttemptByTestId.set(a.test_id, {
            percent: Number(a.percent),
            completed_at: a.completed_at,
          });
        }
      }
    }

    const entitlements = await getEntitlements(user.id);

    const result = (tests ?? []).map((t) => {
      const attempt = latestAttemptByTestId.get(t.id);
      const paywalled = !t.is_free && !entitlements.isHskPro;
      let status: "not_started" | "completed" | "needs_review" | "locked" =
        "not_started";
      if (paywalled) status = "locked";
      else if (attempt) status = attempt.percent >= 60 ? "completed" : "needs_review";

      return {
        id: t.id,
        level: t.level,
        title: t.title,
        isFree: t.is_free,
        sections: (t.test_sections ?? []) as TestSection[],
        paywalled,
        status,
        lastPercent: attempt?.percent ?? null,
      };
    });

    return NextResponse.json({ tests: result });
  } catch (e) {
    console.error("[hsk/tests]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
