import FAQAccordion from "./FAQAccordion";
import SectionHeader from "./SectionHeader";
import { FAQ_ITEMS } from "@/lib/landing-content";

type FAQItemType = { question: string; answer: string };

type FAQProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  items?: FAQItemType[];
};

export default function FAQ({
  id = "faq",
  eyebrow = "Questions",
  title = "Frequently asked questions",
  subtitle = "Clear answers about how LingoIsland works.",
  items = FAQ_ITEMS,
}: FAQProps) {
  return (
    <section
      id={id}
      className="fade-section"
      style={{
        background:
          "radial-gradient(circle at 12% 30%, rgba(160,224,239,0.14), transparent 30%), #FCFEFF",
        padding: "120px 24px",
      }}
    >
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <FAQAccordion items={items} />
      </div>
    </section>
  );
}
