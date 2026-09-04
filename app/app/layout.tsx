import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlossaryProvider } from "@/contexts/GlossaryContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CharacterSetProvider } from "@/contexts/CharacterSetContext";
import AppLayoutClient from "@/components/app/AppLayoutClient";
import { getEntitlements } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "App",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Layout for /app routes
 * Ensures user is authenticated and provides sidebar navigation
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const h = await headers();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const intended = h.get("x-login-next") ?? "/app";
    redirect(`/login?next=${encodeURIComponent(intended)}`);
  }

  // Islands retains its existing free experience. Paid access is enforced at
  // the individual premium actions and APIs, not by blocking the whole app.
  const entitlements = await getEntitlements(user.id);
  const intended = h.get("x-login-next") ?? "/app";
  // HSK pages originally existed below /app. Keep those bookmarked URLs from
  // becoming a second, Islands-authorized entrance to HSK Prep.
  if (intended.startsWith("/app/hsk-")) {
    if (entitlements.isHskPro) {
      redirect(`/hsk${intended}`);
    }
    redirect("/pricing?product=hsk");
  }

  return (
    <LanguageProvider>
      <CharacterSetProvider>
        <GlossaryProvider>
          <AppLayoutClient productTrack="core">{children}</AppLayoutClient>
        </GlossaryProvider>
      </CharacterSetProvider>
    </LanguageProvider>
  );
}
