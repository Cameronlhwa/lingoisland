import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entitlements = await getEntitlements(user.id);
    return NextResponse.json(entitlements);
  } catch (error) {
    console.error("Error in GET /api/entitlements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
