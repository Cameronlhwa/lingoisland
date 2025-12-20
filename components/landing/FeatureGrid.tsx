export default function FeatureGrid() {
  const features = [
    {
      title: "Topic Islands",
      description:
        "10–20 words organized around themes you care about. Each word comes with pinyin, real usage examples, and translations. Build vocabulary that matters to you.",
    },
    {
      title: "Daily Review",
      description:
        "Spaced repetition keeps words from fading. Review at the right moment, before you forget. Turn short-term memory into long-term retention.",
    },
    {
      title: "Story of the Day",
      description:
        "A short paragraph using your recent vocabulary in context. See words come alive in real situations, not isolated flashcards.",
    },
  ];

  return (
    <section className="border-y border-gray-100 bg-white px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
            >
              <h3 className="mb-4 text-2xl font-bold text-gray-900">
                {feature.title}
              </h3>
              <p className="text-base leading-relaxed text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
