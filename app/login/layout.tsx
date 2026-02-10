import type { Metadata } from "next";

// Thin page: noindex so Google does not index login; follow so crawlers can reach the page and see noindex.
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to continue your Mandarin learning journey.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

