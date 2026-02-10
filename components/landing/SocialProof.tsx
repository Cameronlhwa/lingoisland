import TestimonialsCarousel from "./TestimonialsCarousel";

export default function SocialProof() {
  return (
    <section className="border-b border-gray-100 bg-white px-6 py-20 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-2 md:items-start">
          {/* Left column: One H1-level message, then who it's for with H2/H3 hierarchy + chips */}
          <div>
            <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
              Built for learners who want real-life Mandarin
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-gray-600">
              LingoIsland is focused on usable vocabulary and practical
              sentences, not flashy claims.
            </p>

            {/* Who it's for: H2/H3 for SEO, all styled as chips */}
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-gray-500">Who it's for:</p>
              <div className="flex flex-wrap gap-2">
                <h2 className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-normal text-gray-700">
                  Intermediate Mandarin learners
                </h2>
                <h2 className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-normal text-gray-700">
                  Professionals with Chinese clients
                </h2>
                <h2 className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-normal text-gray-700">
                  Visitors to China or Taiwan
                </h2>
                <h3 className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-normal text-gray-700">
                  Mandarin students
                </h3>
                <h3 className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-normal text-gray-700">
                  Non-native Mandarin speakers
                </h3>
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
