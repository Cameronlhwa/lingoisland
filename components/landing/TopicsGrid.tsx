"use client";

import { TOPIC_TILES } from "@/lib/landing-content";
import TopicTile from "./TopicTile";
import SectionHeader from "./SectionHeader";
import SecondaryButton from "./SecondaryButton";

export default function TopicsGrid() {
  return (
    <section
      id="topics"
      className="fade-section"
      style={{
        background:
          "radial-gradient(circle at 12% 20%, rgba(160,224,239,0.16), transparent 32%), #F7FBFD",
        padding: "120px 24px",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <SectionHeader
          eyebrow="Topic Islands"
          title="Browse topics"
          subtitle="Pick a topic and jump straight into practical, real-world vocabulary."
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOPIC_TILES.map((topic, index) => (
            <TopicTile key={topic.slug} topic={topic} index={index} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 40 }}>
          <SecondaryButton href="/topics">View more topics</SecondaryButton>
        </div>
      </div>
    </section>
  );
}
