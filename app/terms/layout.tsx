import type { Metadata } from "next";
import { getCanonicalUrl } from "@/lib/utils/site-url";

export const metadata: Metadata = {
  title: "Terms of Service | LingoIsland",
  description:
    "The terms and conditions governing your use of LingoIsland's AI-powered language learning platform.",
  alternates: {
    canonical: getCanonicalUrl("terms"),
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Terms of Service | LingoIsland",
    description:
      "The terms and conditions governing your use of LingoIsland's AI-powered language learning platform.",
    url: getCanonicalUrl("terms"),
    siteName: "LingoIsland",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Terms of Service | LingoIsland",
    description:
      "The terms and conditions governing your use of LingoIsland's AI-powered language learning platform.",
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
