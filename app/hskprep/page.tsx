import type { Metadata } from "next";
import { Nunito } from "next/font/google";
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
import { getSiteUrl } from "@/lib/utils/site-url";
import {
  HSK_HOW_IT_WORKS_STEPS,
  HSK_FEATURE_HIGHLIGHTS,
  HSK_FAQ_ITEMS,
} from "@/lib/hskprep-content";

const nunito = Nunito({
  weight: ["700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-home-display",
});

const siteUrl = getSiteUrl();
const pageUrl = `${siteUrl}/hskprep`;

export const metadata: Metadata = {
  title: "HSK Prep — Personalized HSK Vocabulary & Practice Tests",
  description:
    "Official HSK vocabulary taught through topics you actually care about, at your own pace — plus 150+ practice tests and targeted weak-spot practice.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "HSK Prep — Personalized HSK Vocabulary & Practice Tests",
    description:
      "Official HSK vocabulary taught through topics you actually care about, at your own pace — plus 150+ practice tests and targeted weak-spot practice.",
    url: pageUrl,
    siteName: "LingoIsland",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "HSK Prep — Personalized HSK Vocabulary & Practice Tests",
    description:
      "Official HSK vocabulary taught through topics you actually care about, at your own pace — plus 150+ practice tests and targeted weak-spot practice.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FAQPage",
      mainEntity: HSK_FAQ_ITEMS.map((faq) => ({
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

export default function HSKPrepPage() {
  return (
    <main className={nunito.variable} style={{ background: "var(--lingo-page-bg)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <FadeSectionObserver />
      <Nav tone="home" />
      <HSKHero
        backgroundImageUrl="/home/hero-cove.png"
        showDecorations={false}
        priorityImage
        underNav
        fadeTo="var(--lingo-page-bg)"
        title={
          <>
            Learn Mandarin
            <br />
            you{" "}
            <BrushUnderline variant="brush" color="var(--lingo-accent, #EC7D28)">
              actually
            </BrushUnderline>{" "}
            need
          </>
        }
      />
      <HSKPillars />
      <HSKCompareSplit />
      <HowItWorks
        id="how"
        title="How it works"
        subtitle="Find your level, build your islands, and check your progress with real practice tests."
        steps={HSK_HOW_IT_WORKS_STEPS}
      />
      <FeatureGrid
        title="Everything you need to prep"
        subtitle="Official HSK vocabulary, personalized topics, and the practice to back it up."
        features={HSK_FEATURE_HIGHLIGHTS}
      />
      <HSKTestimonialPlaceholder />
      <FAQ
        title="Frequently asked questions"
        subtitle="Clear answers about how HSK prep works on LingoIsland."
        items={HSK_FAQ_ITEMS}
      />
      <HSKNightCTA appearance="warm" />
      <Footer track="hsk" />
    </main>
  );
}
