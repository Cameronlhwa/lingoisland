import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ToneTestClient from "./ToneTestClient";

const ADMIN_EMAILS = new Set([
  "cameronlimhwa@gmail.com",
  "themandarinpath@gmail.com",
  "victsang@telus.net",
]);

export default async function ToneTestPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin/tone-test");
  if (!user.email || !ADMIN_EMAILS.has(user.email.toLowerCase())) notFound();

  return <ToneTestClient />;
}
