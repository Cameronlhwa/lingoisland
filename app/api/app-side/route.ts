import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { APP_SIDE_COOKIE, type AppSide } from "@/lib/utils/app-side";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    side?: AppSide;
  } | null;
  const side = body?.side;
  if (side !== "islands" && side !== "hsk") {
    return NextResponse.json({ error: "Invalid app side" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Topic Islands has a signed-in free tier. HSK Prep is a separate,
  // paid-only product.
  const entitlements = await getEntitlements(user.id);
  if (side === "hsk" && !entitlements.isHskPro) {
    return NextResponse.json(
      {
        error: "An HSK Prep subscription is required",
        code: "PRODUCT_ACCESS_REQUIRED",
        product: "hsk",
      },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    side,
    destination: side === "hsk" ? "/hsk/app" : "/app",
  });
  response.cookies.set(APP_SIDE_COOKIE, side, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
