export default function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Choose your topic",
      description:
        "Pick what you want to learn about—work, travel, cooking, anything. We help you build a focused vocabulary island around it.",
    },
    {
      number: "2",
      title: "Learn with context",
      description:
        "Get 10–20 words with pinyin, example sentences, and translations. See how words work together, not in isolation.",
    },
    {
      number: "3",
      title: "Review and remember",
      description:
        "Daily review sessions use spaced repetition. Stories reinforce your new words. Words stick because you see them when it counts.",
    },
  ];

  return (
    <section className="bg-gray-50 px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-20 text-center text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
          How it works
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:border-gray-300 hover:shadow-md">
                <div className="mb-6 text-6xl font-bold text-gray-200">
                  {step.number}
                </div>
                <h3 className="mb-4 text-xl font-bold text-gray-900">
                  {step.title}
                </h3>
                <p className="text-base leading-relaxed text-gray-600">
                  {step.description}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 md:block">
                  <div className="h-0.5 w-12 border-t-2 border-dashed border-gray-300"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
