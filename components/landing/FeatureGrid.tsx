import FeatureCard from "./FeatureCard";
import SectionHeader from "./SectionHeader";
import { FEATURE_HIGHLIGHTS } from "@/lib/landing-content";

type Feature = { title: string; description: string };

type FeatureGridProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  features?: Feature[];
};

export default function FeatureGrid({
  id,
  eyebrow = "What's included",
  title = "Everything you need to make words stick",
  subtitle = "Build vocabulary you can actually use, then lock it in with context and review.",
  features = FEATURE_HIGHLIGHTS,
}: FeatureGridProps) {
  return (
    <section
      id={id}
      className="fade-section"
      style={{
        background:
          "radial-gradient(circle at 88% 25%, var(--lingo-accent-tint), transparent 30%), #fff",
        padding: "120px 24px",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
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
