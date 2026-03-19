import TestimonialsCarousel from "./TestimonialsCarousel";

export default function SocialProof() {
  return (
    <section
      className="fade-section"
      style={{ background: "#fff", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-2">
          {/* Left: copy */}
          <div>
            <h2
              style={{
                fontFamily: "'Lora', Georgia, serif",
                fontWeight: 600,
                fontSize: 36,
                lineHeight: 1.15,
                color: "#071E2E",
                marginBottom: 16,
              }}
            >
              Built for learners who want{" "}
              <em style={{ fontStyle: "italic", color: "#2176AE" }}>real-life</em>{" "}
              Mandarin
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "#3a6e88",
                lineHeight: 1.65,
                marginBottom: 24,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              LingoIsland is focused on usable vocabulary and practical
              sentences, not flashy claims.
            </p>

            {/* Audience tags */}
            <div>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#7aA0b4",
                  marginBottom: 10,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                Who it&apos;s for:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  "Intermediate Mandarin learners",
                  "Professionals with Chinese clients",
                  "Visitors to China or Taiwan",
                  "Mandarin students",
                  "Non-native Mandarin speakers",
                ].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: "#EAF4FB",
                      border: "1px solid rgba(33,118,174,0.15)",
                      borderRadius: 20,
                      padding: "5px 14px",
                      fontSize: 12,
                      color: "#1a5f8a",
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: testimonials */}
          <TestimonialsCarousel />
        </div>
      </div>
    </section>
  );
}
