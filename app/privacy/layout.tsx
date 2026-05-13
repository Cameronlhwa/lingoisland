import type { Metadata } from "next";
import { getCanonicalUrl } from "@/lib/utils/site-url";

export const metadata: Metadata = {
  title: "Privacy Policy | LingoIsland",
  description:
    "How LingoIsland collects, uses, and protects your information when you use our Mandarin learning service.",
  alternates: {
    canonical: getCanonicalUrl("privacy"),
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Privacy Policy | LingoIsland",
    description:
      "How LingoIsland collects, uses, and protects your information when you use our Mandarin learning service.",
    url: getCanonicalUrl("privacy"),
    siteName: "LingoIsland",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | LingoIsland",
    description:
      "How LingoIsland collects, uses, and protects your information when you use our Mandarin learning service.",
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
