import FeatureCard from "./FeatureCard";
import { FEATURE_HIGHLIGHTS } from "@/lib/landing-content";

export default function FeatureGrid() {
  return (
    <section
      className="fade-section"
      style={{ background: "#fff", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontWeight: 600,
              fontSize: 36,
              lineHeight: 1.15,
              color: "#071E2E",
              marginBottom: 12,
            }}
          >
            Everything you need to make words stick
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#3a6e88",
              lineHeight: 1.65,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            Build vocabulary you can actually use, then lock it in with context
            and review.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
