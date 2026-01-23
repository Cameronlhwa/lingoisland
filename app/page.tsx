import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import FeatureGrid from "@/components/landing/FeatureGrid";
import HowItWorks from "@/components/landing/HowItWorks";
import DailyHubPreview from "@/components/landing/DailyHubPreview";
import SocialProof from "@/components/landing/SocialProof";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/landing/Footer";
import AuthRedirectHandler from "@/components/AuthRedirectHandler";
import { getSiteUrl } from "@/lib/utils/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Remember your Mandarin",
  description:
    "Overcome the intermediate plateau with daily review, personalized stories, and topic-based vocabulary for A2–B2 learners.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Remember your Mandarin",
    description:
      "Overcome the intermediate plateau with daily review, personalized stories, and topic-based vocabulary for A2–B2 learners.",
    url: siteUrl,
    siteName: "Lingo Island",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Remember your Mandarin",
    description:
      "Overcome the intermediate plateau with daily review, personalized stories, and topic-based vocabulary for A2–B2 learners.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Lingo Island",
      url: siteUrl,
    },
    {
      "@type": "WebSite",
      name: "Lingo Island",
      url: siteUrl,
    },
    {
      "@type": "SoftwareApplication",
      name: "Lingo Island",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Daily review, personalized stories, and topic-based vocabulary for Mandarin learners.",
    },
  ],
};

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Suspense fallback={null}>
        <AuthRedirectHandler />
      </Suspense>
      <Nav />
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <DailyHubPreview />
      <SocialProof />
      <FAQ />
      <Footer />
    </main>
  );
}
