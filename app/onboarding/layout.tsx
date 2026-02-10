import type { Metadata } from "next";

// Thin pages: noindex so Google does not index onboarding; follow so crawlers can reach them and see noindex.
export const metadata: Metadata = {
  title: "Onboarding",
  description: "Set up your first topic island to start learning.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

