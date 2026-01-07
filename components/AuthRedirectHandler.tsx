"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Client-side component that handles OAuth redirects when Supabase
 * redirects to the wrong domain (e.g., production instead of localhost).
 * 
 * Checks if we're on the wrong domain and redirects to the correct origin.
 */
export default function AuthRedirectHandler() {
  const searchParams = useSearchParams();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Prevent multiple checks
    if (hasChecked) return;
    setHasChecked(true);

    // Check URL directly (more reliable than searchParams)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code") || searchParams.get("code");

    // Only handle if there's a code parameter (OAuth callback)
    if (!code) return;

    // Try to get origin from cookie first (more reliable), then localStorage
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    
    const storedOrigin = getCookie("oauth_origin") || localStorage.getItem("oauth_origin");
    const storedNext = getCookie("oauth_next") || localStorage.getItem("oauth_next");
    const currentOrigin = window.location.origin;
    // Try cookie first, then URL params, then default
    const next = storedNext || urlParams.get("next") || searchParams.get("next") || "/app";

    // If we have a stored origin and we're on a different domain, redirect
    if (storedOrigin && storedOrigin !== currentOrigin) {
      const redirectUrl = new URL("/auth/callback", storedOrigin);
      redirectUrl.searchParams.set("code", code);
      if (next) {
        redirectUrl.searchParams.set("next", next);
      }

      // Clear the stored origin and next (both cookie and localStorage)
      document.cookie = "oauth_origin=; path=/; max-age=0";
      document.cookie = "oauth_next=; path=/; max-age=0";
      localStorage.removeItem("oauth_origin");
      localStorage.removeItem("oauth_next");

      // Redirect to the correct origin immediately
      window.location.href = redirectUrl.toString();
      return;
    }

    // If we're on the correct domain, clear the stored origin and next
    if (storedOrigin === currentOrigin) {
      document.cookie = "oauth_origin=; path=/; max-age=0";
      document.cookie = "oauth_next=; path=/; max-age=0";
      localStorage.removeItem("oauth_origin");
      localStorage.removeItem("oauth_next");
    }
  }, [hasChecked, searchParams]);

  return null; // This component doesn't render anything
}

