import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding",
  description: "Set up your first topic island to start learning.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

