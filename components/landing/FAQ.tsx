export default function FAQ() {
  const faqs = [
    {
      question: "I keep forgetting vocabulary. Will this help?",
      answer:
        "Yes. Daily review uses spaced repetition to show you words right before you forget them. Stories reinforce vocabulary in context, which helps with long-term retention. Most learners see words stick after 2–3 weeks of consistent practice.",
    },
    {
      question: "What if I&apos;m between A2 and B2?",
      answer:
        "Perfect. Lingo Island is designed for intermediate learners who know basic grammar but struggle with vocabulary retention. Topic Islands let you choose content at your level, and the system adapts to what you already know.",
    },
    {
      question: "How are Topic Islands different from word lists?",
      answer:
        "Topic Islands group 10–20 related words around themes you care about. Each word comes with pinyin, example sentences, and translations. Instead of random lists, you build vocabulary that connects—which makes it easier to remember and use in real conversations.",
    },
    {
      question: "Do I need to review every single day?",
      answer:
        "Not necessarily. The spaced repetition algorithm prioritizes words you&apos;re about to forget. Missing a day or two is fine, but consistency helps. Aim for 4–5 days per week to see progress.",
    },
    {
      question: "Can I use this alongside other Mandarin resources?",
      answer:
        "Absolutely. Lingo Island focuses on vocabulary retention and context. Use it with textbooks, classes, or apps. The daily review and stories complement any learning method.",
    },
  ];

  return (
    <section className="bg-gray-50 px-6 py-24 md:px-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-16 text-center text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
            >
              <h3 className="mb-4 text-xl font-bold text-gray-900">
                {faq.question}
              </h3>
              <p className="text-base leading-relaxed text-gray-600">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
