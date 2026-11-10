import { NextResponse } from "next/server";
import { maskPhoneNumber } from "@/lib/sms/phone";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("sms_contacts")
    .select("id, phone_number, display_name, language_level, persona, status, verified_at, created_at")
    .eq("user_id", user.id)
    .neq("status", "released")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Could not load contacts" }, { status: 500 });
  return NextResponse.json({
    contacts: (data || []).map(({ phone_number, ...contact }) => ({
      ...contact,
      masked_number: maskPhoneNumber(phone_number),
    })),
  });
}

// Contacts can only be created by proving ownership of the number.
export async function POST() {
  return NextResponse.json(
    { error: "Use /api/sms/phone/start and /api/sms/phone/verify to add a phone number." },
    { status: 410 }
  );
}
