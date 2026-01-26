import FeatureCard from "./FeatureCard";
import { FEATURE_HIGHLIGHTS } from "@/lib/landing-content";

export default function FeatureGrid() {
  return (
    <section className="border-y border-gray-100 bg-white px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
            Everything you need to make words stick
          </h2>
          <p className="mt-3 text-lg text-gray-600">
            Build vocabulary you can actually use, then lock it in with context
            and review.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_HIGHLIGHTS.map((feature) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
