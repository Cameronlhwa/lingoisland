import type { Metadata } from "next";
import { getCanonicalUrl } from "@/lib/utils/site-url";

export const metadata: Metadata = {
  title: "About Cameron Lim",
  description:
    "Cameron Lim built LingoIsland—topic-first Mandarin vocabulary, level-tuned sentences, and a system that sticks. 120K+ YouTube subscribers, 2M+ views. Learn why it exists.",
  alternates: {
    canonical: getCanonicalUrl("founder"),
  },
  openGraph: {
    title: "About Cameron Lim — LingoIsland",
    description:
      "Cameron Lim built LingoIsland for real-life Mandarin that sticks. 120K+ YouTube subscribers, 2M+ views.",
    url: getCanonicalUrl("founder"),
    siteName: "LingoIsland",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "About Cameron Lim — LingoIsland",
    description:
      "Cameron Lim built LingoIsland for real-life Mandarin that sticks. 120K+ YouTube subscribers, 2M+ views.",
  },
};

export default function FounderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
