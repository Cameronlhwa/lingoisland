import type { Metadata } from "next";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import FadeSectionObserver from "@/components/landing/FadeSectionObserver";
import HowItWorks from "@/components/landing/HowItWorks";
import FeatureGrid from "@/components/landing/FeatureGrid";
import FAQ from "@/components/landing/FAQ";
import BrushUnderline from "@/components/landing/BrushUnderline";
import HSKHero from "@/components/hskprep/HSKHero";
import HSKPillars from "@/components/hskprep/HSKPillars";
import HSKCompareSplit from "@/components/hskprep/HSKCompareSplit";
import HSKTestimonialPlaceholder from "@/components/hskprep/HSKTestimonialPlaceholder";
import HSKNightCTA from "@/components/hskprep/HSKNightCTA";
import TopicsGrid from "@/components/landing/TopicsGrid";
import { getSiteUrl } from "@/lib/utils/site-url";
import {
  FAQ_ITEMS,
  LANDING_PILLARS,
  LANDING_COMPARE,
  LANDING_TESTIMONIAL,
  HOW_IT_WORKS_STEPS,
  FEATURE_HIGHLIGHTS,
} from "@/lib/landing-content";

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
    <main style={{ background: "#fff" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <FadeSectionObserver />
      <Nav />
      <HSKHero
        title={
          <>
            Learn Mandarin you{" "}
            <BrushUnderline>actually need</BrushUnderline>
          </>
        }
        subtitle="Topic Islands with real-life sentences, stories, and review — vocabulary that shows up in conversation, not just textbooks."
        ctaHref="/onboarding/journey"
        ctaLabel="Try for free"
      />
      <HSKPillars
        pillars={LANDING_PILLARS}
        capybaraOnTitle="Stories + Review"
      />
      <HSKCompareSplit id="demo" compare={LANDING_COMPARE} />
      <HowItWorks
        id="how-it-works"
        title="How it works"
        subtitle="A simple loop designed for consistent, real-life vocabulary growth."
        steps={HOW_IT_WORKS_STEPS}
      />
      <FeatureGrid
        id="features"
        title="Everything you need to stick with it"
        subtitle="Authentic sentences, stories, quizzes, and flashcards — built around topics you care about."
        features={FEATURE_HIGHLIGHTS}
      />
      <TopicsGrid />
      <HSKTestimonialPlaceholder testimonial={LANDING_TESTIMONIAL} />
      <FAQ
        title="Frequently asked questions"
        subtitle="Clear answers about how LingoIsland helps you learn Mandarin you'll actually use."
        items={FAQ_ITEMS}
      />
      <HSKNightCTA
        title="Ready to build vocabulary you can actually use?"
        subtitle="Create a Topic Island around what matters to you. Free to start — no credit card needed."
        primary={{ href: "/onboarding/journey", label: "Try for free" }}
        secondary={{ href: "/topics", label: "Explore Topics" }}
      />
      <Footer />
    </main>
  );
}
