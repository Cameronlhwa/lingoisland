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
  title: "App — HSK Prep",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Preview layout for the HSK track's home screen at /hsk/app — always
 * renders the HSK sidebar/dashboard regardless of the signed-in account's
 * product_track, so the HSK experience can be browsed directly without
 * flipping an account's track. Real HSK-track users still land on the
 * track-aware /app (see app/app/layout.tsx).
 */
export default async function HskAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const h = await headers();
    const intended = h.get("x-login-next") ?? "/hsk/app";
    redirect(`/login?next=${encodeURIComponent(intended)}`);
  }

  // This used to be an unrestricted preview route. Product access must be
  // verified on the server; a client-side tab guard can be bypassed by a URL.
  const entitlements = await getEntitlements(user.id);
  if (!entitlements.isHskPro) {
    if (entitlements.isIslandsPro) {
      redirect("/app?upgradeProduct=hsk");
    }
    redirect("/pricing?product=hsk");
  }

  return (
    <LanguageProvider>
      <CharacterSetProvider>
        <GlossaryProvider>
          <AppLayoutClient productTrack="hsk" hskAppTheme>
            {children}
          </AppLayoutClient>
        </GlossaryProvider>
      </CharacterSetProvider>
    </LanguageProvider>
  );
}
