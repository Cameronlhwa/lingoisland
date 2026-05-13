import type { Metadata } from "next";
import { getCanonicalUrl } from "@/lib/utils/site-url";

export const metadata: Metadata = {
  title: "Contact Us | LingoIsland",
  description:
    "Get in touch with the LingoIsland team. We're here to help with questions, feedback, and support.",
  alternates: {
    canonical: getCanonicalUrl("contact"),
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Contact Us | LingoIsland",
    description:
      "Get in touch with the LingoIsland team. We're here to help with questions, feedback, and support.",
    url: getCanonicalUrl("contact"),
    siteName: "LingoIsland",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Contact Us | LingoIsland",
    description:
      "Get in touch with the LingoIsland team. We're here to help with questions, feedback, and support.",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
