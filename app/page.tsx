import type { Metadata } from "next";
import { nunito } from "./fonts/nunito";
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
import HSKNightCTA from "@/components/hskprep/HSKNightCTA";
import TopicsGrid from "@/components/landing/TopicsGrid";
import LearnerTestimonials from "@/components/landing/LearnerTestimonials";
import { getSiteUrl } from "@/lib/utils/site-url";
import {
  FAQ_ITEMS,
  LANDING_PILLARS,
  LANDING_COMPARE,
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
    <div className={`lingo-home ${nunito.variable}`}>
      <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <FadeSectionObserver />
      <Nav tone="home" ctaLabel="Build my plan" />
      <HSKHero
        backgroundImageUrl="/home/hero-cove.png"
        showDecorations={false}
        priorityImage
        underNav
        fadeTo="var(--lingo-page-bg)"
        title={
          <span className="hero-home-title">
            Learn the Mandarin you{" "}
            <BrushUnderline variant="brush" color="var(--lingo-accent, #EC7D28)">
              actually need
            </BrushUnderline>{" "}
            in 10 minutes a day.
          </span>
        }
        subtitle="Personalized lessons for your work, studies, and real life."
        ctaHref="/onboarding/journey"
        ctaLabel="Build my learning plan"
        journeyTransition
      />
      <HSKPillars
        pillars={LANDING_PILLARS}
        capybaraOnTitle="Stories + Review"
      />
      <HSKCompareSplit id="demo" compare={LANDING_COMPARE} startHref="/onboarding/journey" />
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
      <LearnerTestimonials />
      <FAQ
        title="Frequently asked questions"
        subtitle="Clear answers about how LingoIsland helps you learn Mandarin you'll actually use."
        items={FAQ_ITEMS}
      />
      <HSKNightCTA
        appearance="warm"
        layout="split"
        title="Turn 10 minutes into Mandarin you can actually use"
        highlight="actually use"
        subtitle="Personalized lessons for your work, studies, and real life."
        primary={{ href: "/onboarding/journey", label: "Build my learning plan" }}
        secondary={null}
      />
      <Footer />
      </main>
    </div>
  );
}
