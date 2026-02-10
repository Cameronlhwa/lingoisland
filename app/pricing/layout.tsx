import type { Metadata } from "next";
import { getCanonicalUrl } from "@/lib/utils/site-url";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Choose monthly or yearly Pro access. Manage billing anytime.",
  alternates: {
    canonical: getCanonicalUrl("pricing"),
  },
  openGraph: {
    title: "Pricing — Lingo Island",
    description:
      "Choose monthly or yearly Pro access. Manage billing anytime.",
    url: getCanonicalUrl("pricing"),
    siteName: "Lingo Island",
    type: "website",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
