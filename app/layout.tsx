import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import AuthRedirectHandler from "@/components/AuthRedirectHandler";
import { getSiteUrl } from "@/lib/utils/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Lingo Island",
    template: "Lingo Island — %s",
  },
  description:
    "Mandarin vocabulary by topic with real-life example sentences, daily stories, and spaced repetition review.",
  openGraph: {
    title: {
      default: "Lingo Island",
      template: "Lingo Island — %s",
    },
    description:
      "Mandarin vocabulary by topic with real-life example sentences, daily stories, and spaced repetition review.",
    url: siteUrl,
    siteName: "Lingo Island",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: {
      default: "Lingo Island",
      template: "Lingo Island — %s",
    },
    description:
      "Mandarin vocabulary by topic with real-life example sentences, daily stories, and spaced repetition review.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Inline script to catch OAuth redirects immediately, before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var urlParams = new URLSearchParams(window.location.search);
                  var code = urlParams.get('code');
                  if (code) {
                    // Try cookie first, then localStorage
                    var getCookie = function(name) {
                      var value = '; ' + document.cookie;
                      var parts = value.split('; ' + name + '=');
                      if (parts.length === 2) return parts.pop().split(';').shift();
                      return null;
                    };
                    var storedOrigin = getCookie('oauth_origin') || localStorage.getItem('oauth_origin');
                    var storedNext = getCookie('oauth_next') || localStorage.getItem('oauth_next');
                    var currentOrigin = window.location.origin;
                    // Try cookie first, then URL params, then default
                    var next = storedNext || urlParams.get('next') || '/app';
                    if (storedOrigin && storedOrigin !== currentOrigin) {
                      var redirectUrl = storedOrigin + '/auth/callback?code=' + encodeURIComponent(code) + '&next=' + encodeURIComponent(next);
                      // Clear both cookie and localStorage
                      document.cookie = 'oauth_origin=; path=/; max-age=0';
                      document.cookie = 'oauth_next=; path=/; max-age=0';
                      localStorage.removeItem('oauth_origin');
                      localStorage.removeItem('oauth_next');
                      window.location.href = redirectUrl;
                      return;
                    } else if (storedOrigin === currentOrigin) {
                      // Clear storage
                      document.cookie = 'oauth_origin=; path=/; max-age=0';
                      document.cookie = 'oauth_next=; path=/; max-age=0';
                      localStorage.removeItem('oauth_origin');
                      localStorage.removeItem('oauth_next');
                    }
                  }
                } catch (e) {
                  console.error('[AUTH REDIRECT SCRIPT] Error:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <Suspense fallback={null}>
          <AuthRedirectHandler />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
