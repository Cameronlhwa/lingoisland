import FAQAccordion from "./FAQAccordion";
import { FAQ_ITEMS } from "@/lib/landing-content";

export default function FAQ() {
  return (
    <section id="faq" className="bg-gray-50 px-6 py-24 md:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-3 text-lg text-gray-600">
            Clear answers about how LingoIsland works.
          </p>
        </div>
        <FAQAccordion items={FAQ_ITEMS} />
      </div>
    </section>
  );
}
