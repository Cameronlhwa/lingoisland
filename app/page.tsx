import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Hero from "@/components/landing/Hero";
import WhyLingoIsland from "@/components/landing/WhyLingoIsland";
import ProofDemo from "@/components/landing/ProofDemo";
import FeatureGrid from "@/components/landing/FeatureGrid";
import HowItWorks from "@/components/landing/HowItWorks";
import TopicsGrid from "@/components/landing/TopicsGrid";
import SocialProof from "@/components/landing/SocialProof";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";
import { getSiteUrl } from "@/lib/utils/site-url";
import { FAQ_ITEMS } from "@/lib/landing-content";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Mandarin vocabulary by topic — with real-life example sentences",
  description:
    "Learn Mandarin vocabulary by topic with authentic, level-tuned sentences, Daily Stories, quizzes, and flashcard decks built for real-life use.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Mandarin vocabulary by topic — with real-life example sentences",
    description:
      "Learn Mandarin vocabulary by topic with authentic, level-tuned sentences, Daily Stories, quizzes, and flashcard decks built for real-life use.",
    url: siteUrl,
    siteName: "LingoIsland",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mandarin vocabulary by topic — with real-life example sentences",
    description:
      "Learn Mandarin vocabulary by topic with authentic, level-tuned sentences, Daily Stories, quizzes, and flashcard decks built for real-life use.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "LingoIsland",
      url: siteUrl,
    },
    {
      "@type": "WebSite",
      name: "LingoIsland",
      url: siteUrl,
    },
    {
      "@type": "SoftwareApplication",
      name: "LingoIsland",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Mandarin vocabulary by topic with authentic, level-tuned sentences and daily stories.",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
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
      <Nav />
      <Hero />
      {/* Why LingoIsland */}
      <WhyLingoIsland />
      {/* Proof demo */}
      <ProofDemo />
      {/* How it works loop */}
      <HowItWorks />
      {/* Feature highlights */}
      <FeatureGrid />
      {/* Browse topics */}
      <TopicsGrid />
      {/* Social proof */}
      <SocialProof />
      {/* FAQ */}
      <FAQ />
      {/* Final CTA */}
      <FinalCTA />
      <Footer />
    </main>
  );
}
