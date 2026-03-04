import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { getSiteUrl } from "@/lib/utils/site-url";
import { TTSProvider } from "@/contexts/TTSContext";
import { PostHogProvider } from "@/components/PostHogProvider";
import { PostHogPageView } from "@/components/PostHogPageView";

const GOOGLE_ADS_ID = "AW-17988323365";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Lingo Island",
    template: "Lingo Island — %s",
  },
  description:
    "Mandarin vocabulary by topic with real-life example sentences, daily stories, and spaced repetition review.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
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
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 1200,
        alt: "Lingo Island Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: {
      default: "Lingo Island",
      template: "Lingo Island — %s",
    },
    description:
      "Mandarin vocabulary by topic with real-life example sentences, daily stories, and spaced repetition review.",
    images: ["/logo.png"],
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
        {/* Google tag (gtag.js) — single installation for Google Ads. Load in head with beforeInteractive
            so Google Ads "Test installation" and Tag Assistant detect it reliably.
            Purchase conversion is URL-based (page load on .../app?checkout=success); no gtag('event') needed.
            Verify: Tag Assistant in incognito on lingoisland.com/app; Google Ads "Test installation" after deploy.
            In Google Ads → Purchase conversion → Count: set to "One" (not "Every conversion") to avoid double-count on refresh. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="beforeInteractive"
        />
        <Script
          id="gtag-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ADS_ID}');
            `,
          }}
        />
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
        <PostHogProvider>
          <PostHogPageView />
          <TTSProvider>{children}</TTSProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
