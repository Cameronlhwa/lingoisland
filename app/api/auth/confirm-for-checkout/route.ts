import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Confirms email for a just-created / guest-converted account and returns a
 * one-time token the client can verify to open a real (non-anonymous) session
 * without leaving the page for an inbox link.
 */
export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server auth is not configured" },
        { status: 500 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      userId?: string;
      email?: string;
    } | null;

    const supabase = await createServerClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    const requestedUserId =
      typeof body?.userId === "string" ? body.userId : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    // This route can confirm an email and mint a one-time sign-in token. It
    // must therefore only act on the authenticated browser session, never a
    // caller-supplied user id.
    if (!sessionUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (requestedUserId && requestedUserId !== sessionUser.id) {
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    }
    const userId = sessionUser.id;

    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
      return NextResponse.json({ error: "Missing user" }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing, error: getErr } =
      await admin.auth.admin.getUserById(userId);
    if (getErr || !existing.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const accountEmail = (
      existing.user.email ||
      // Guest email change may sit in new_email until confirmed.
      (existing.user as { new_email?: string | null }).new_email ||
      ""
    ).toLowerCase();
    if (email && accountEmail && email !== accountEmail) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }
    if (!accountEmail && !email) {
      return NextResponse.json(
        { error: "Account has no email yet" },
        { status: 400 },
      );
    }

    const targetEmail = accountEmail || email;

    const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
      email: targetEmail,
      email_confirm: true,
    });
    if (updateErr) {
      console.error("[confirm-for-checkout] update failed:", updateErr);
      return NextResponse.json(
        { error: updateErr.message || "Could not confirm account" },
        { status: 500 },
      );
    }

    // Issue a magic-link token so the browser can open a permanent session
    // without password sign-in (which often fails while a guest JWT is active).
    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
      });
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("[confirm-for-checkout] generateLink failed:", linkErr);
      // Confirm still succeeded — client can try password sign-in as fallback.
      return NextResponse.json({ ok: true, email: targetEmail });
    }

    return NextResponse.json({
      ok: true,
      email: targetEmail,
      tokenHash: linkData.properties.hashed_token,
    });
  } catch (error) {
    console.error("[confirm-for-checkout]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
