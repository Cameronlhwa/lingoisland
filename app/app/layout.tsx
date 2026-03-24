import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlossaryProvider } from "@/contexts/GlossaryContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CharacterSetProvider } from "@/contexts/CharacterSetContext";
import AppLayoutClient from "@/components/app/AppLayoutClient";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const h = await headers();
    const intended = h.get("x-login-next") ?? "/app";
    redirect(`/login?next=${encodeURIComponent(intended)}`);
  }

  return (
    <LanguageProvider>
      <CharacterSetProvider>
        <GlossaryProvider>
          <AppLayoutClient>{children}</AppLayoutClient>
        </GlossaryProvider>
      </CharacterSetProvider>
    </LanguageProvider>
  );
}
