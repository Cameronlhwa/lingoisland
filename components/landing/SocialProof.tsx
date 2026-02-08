import { LEARNER_BULLETS } from "@/lib/landing-content";
import TestimonialsCarousel from "./TestimonialsCarousel";

export default function SocialProof() {
  return (
    <section className="border-b border-gray-100 bg-white px-6 py-20 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          {/* Left column: Headline + paragraph + who it's for */}
          <div>
            <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
              Built for learners who want real-life Mandarin
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              LingoIsland is focused on usable vocabulary and practical
              sentences, not flashy claims.
            </p>

            {/* Who it's for - converted to lighter chips */}
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-gray-500">Who it's for:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Intermediate plateau breakers",
                  "Busy professionals",
                  "Topic-focused learners",
                  "Self-learners seeking real sentences",
                ].map((chip) => (
                  <div
                    key={chip}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700"
                  >
                    {chip}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Testimonials carousel */}
          <TestimonialsCarousel />
        </div>
      </div>
    </section>
  );
}
