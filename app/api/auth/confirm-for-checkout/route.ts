import { NextResponse } from "next/server";
import { createClient, type AuthError } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public signup does not create a browser session while email confirmation is
 * required. Prove the caller knows the password (GoTrue checks the password
 * before it returns email_not_confirmed), then confirm that account and mint
 * a one-time token. A caller-supplied user id is never trusted here.
 */
async function confirmSignupWithoutSession(
  supabaseUrl: string,
  serviceKey: string,
  anonKey: string,
  email: string,
  password: string,
  requestedUserId: string,
) {
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInErr) {
    // Already confirmed. The browser signs in with the same password.
    return NextResponse.json({ ok: true, email });
  }

  const code = (signInErr as AuthError).code ?? "";
  const passwordMatchedUnconfirmed =
    code === "email_not_confirmed" || /not confirmed/i.test(signInErr.message);
  if (!passwordMatchedUnconfirmed) {
    return NextResponse.json(
      { error: "Could not finish account setup. Check your email and password." },
      { status: 401 },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fresh signups send the id Supabase just returned. Use it only when that
  // account's email is the one whose password we already verified.
  let userId = "";
  if (/^[0-9a-f-]{36}$/i.test(requestedUserId)) {
    const { data: existing } = await admin.auth.admin.getUserById(requestedUserId);
    const existingEmail = (
      existing.user?.email ||
      (existing.user as { new_email?: string | null } | undefined)?.new_email ||
      ""
    ).toLowerCase();
    if (existing.user && existingEmail === email) userId = existing.user.id;
  }

  let linkData: Awaited<
    ReturnType<typeof admin.auth.admin.generateLink>
  >["data"] | null = null;

  if (!userId) {
    const generated = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    linkData = generated.data;
    if (generated.error || !generated.data?.user?.id) {
      console.error("[confirm-for-checkout] generateLink failed:", generated.error);
      return NextResponse.json(
        { error: "Could not confirm account" },
        { status: 500 },
      );
    }
    userId = generated.data.user.id;
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });
  if (updateErr) {
    console.error("[confirm-for-checkout] update failed:", updateErr);
    return NextResponse.json(
      { error: "Could not confirm account" },
      { status: 500 },
    );
  }

  if (!linkData?.properties?.hashed_token) {
    const generated = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    linkData = generated.data;
  }

  return NextResponse.json({
    ok: true,
    email,
    tokenHash: linkData?.properties?.hashed_token,
  });
}

/**
 * Confirms email for a just-created / guest-converted account and returns a
 * one-time token the client can verify to open a real (non-anonymous) session
 * without leaving the page for an inbox link.
 */
export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!serviceKey || !supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: "Server auth is not configured" },
        { status: 500 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      userId?: string;
      email?: string;
      password?: string;
    } | null;

    const supabase = await createServerClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    const requestedUserId =
      typeof body?.userId === "string" ? body.userId : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    // No browser session yet: a fresh email signup is unconfirmed until this
    // route runs, so the only proof we can accept is the password just chosen.
    if (!sessionUser?.id) {
      if (!email || password.length < 6) {
        return NextResponse.json(
          { error: "Could not finish account setup. Check your email and password." },
          { status: 401 },
        );
      }
      return await confirmSignupWithoutSession(
        supabaseUrl,
        serviceKey,
        anonKey,
        email,
        password,
        requestedUserId,
      );
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
