import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = { status?: string };

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.status !== "active" && body.status !== "mastered") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pronunciation_weak_sounds")
    .update({
      status: body.status,
      mastered_at: body.status === "mastered" ? new Date().toISOString() : null,
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Weak sound not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
