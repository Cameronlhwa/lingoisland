import MarketingShell from "@/components/landing/MarketingShell";
import type { Metadata } from "next";
import { getCanonicalUrl } from "@/lib/utils/site-url";
const title = "Our Team | Cameron & Sherly";
const description = "Meet Cameron and Sherly of The Mandarin Path: the team building LingoIsland and shaping practical, thoughtfully structured Mandarin lessons.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: getCanonicalUrl("team") },
  robots: { index: true, follow: true },
  openGraph: { title, description, url: getCanonicalUrl("team"), siteName: "LingoIsland", type: "website" },
  twitter: { card: "summary", title, description },
};
export default function TeamLayout({ children }: { children: React.ReactNode }) { return <MarketingShell>{children}</MarketingShell>; }
