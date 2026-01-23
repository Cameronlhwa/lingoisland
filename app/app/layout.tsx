import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/app/Sidebar";
import { LanguageProvider } from "@/contexts/LanguageContext";

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
    redirect("/login");
  }

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-white">
        <Sidebar />
        <main className="ml-64">{children}</main>
      </div>
    </LanguageProvider>
  );
}
