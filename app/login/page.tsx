"use client";

import { createClient } from "@/lib/supabase/browser";
import { useRouter, usePathname } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    // Pass redirectTo WITHOUT query parameters (Supabase validates exact match)
    const redirectTo = `${location.origin}/auth/callback`;

    // Store the next path separately (will be read from cookie in callback)
    // Don't redirect back to /login - default to /app instead
    const nextPath = pathname && pathname !== "/login" ? pathname : "/app";
    localStorage.setItem("oauth_next", nextPath);
    document.cookie = `oauth_next=${nextPath}; path=/; max-age=600; SameSite=Lax`;

    // Store the origin in both localStorage AND cookie (cookie is more reliable across redirects)
    localStorage.setItem("oauth_origin", location.origin);
    // Set cookie that expires in 10 minutes (enough for OAuth flow)
    document.cookie = `oauth_origin=${location.origin}; path=/; max-age=600; SameSite=Lax`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error("Error signing in:", error);
      alert("Failed to sign in. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Welcome to Lingo Island
          </h1>
          <p className="text-lg text-gray-600">
            Sign in to start building your vocabulary
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full rounded-lg border border-gray-900 bg-white px-6 py-4 text-base font-medium uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50"
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}
