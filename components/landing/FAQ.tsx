import FAQAccordion from "./FAQAccordion";
import { FAQ_ITEMS } from "@/lib/landing-content";

export default function FAQ() {
  return (
    <section
      id="faq"
      className="fade-section"
      style={{ background: "#F4F8FB", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
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
            Frequently asked questions
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#3a6e88",
              lineHeight: 1.65,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            Clear answers about how LingoIsland works.
          </p>
        </div>
        <FAQAccordion items={FAQ_ITEMS} />
      </div>
    </section>
  );
}
