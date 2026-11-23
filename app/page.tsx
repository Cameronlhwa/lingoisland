import type { Metadata } from "next";
import NewLandingPage from "@/components/landing/NewLandingPage";
import { getSiteUrl } from "@/lib/utils/site-url";

const title = "Learn the Mandarin that matters to you";
const description =
  "Structured Mandarin learning built around your life. Learn practical vocabulary and grammar, practice pronunciation, and put it into conversation with Huahua.";
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: getSiteUrl() },
  openGraph: {
    title,
    description,
    url: getSiteUrl(),
    siteName: "LingoIsland",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LingoIsland",
    url: getSiteUrl(),
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description,
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <NewLandingPage />
    </>
  );
}
