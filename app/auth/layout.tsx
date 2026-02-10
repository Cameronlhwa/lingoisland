import type { Metadata } from "next";

// Auth routes (e.g. callback) are not indexable; follow so crawlers can see noindex if any page is added.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
