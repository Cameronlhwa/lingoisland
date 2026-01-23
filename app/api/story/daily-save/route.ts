import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const storyId = body?.storyId;

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("stories")
      .update({ saved: true })
      .eq("id", storyId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Failed to save daily story" },
        { status: 500 }
      );
    }

    return NextResponse.json({ story: updated });
  } catch (error) {
    console.error("Error in POST /api/story/daily-save:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

