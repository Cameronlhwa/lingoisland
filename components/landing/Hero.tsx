import HeroCTA from "./HeroCTA";

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-white to-gray-50 px-6 py-20 md:px-12 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-20">
          {/* Left: Headline */}
          <div className="flex flex-col justify-center">
            <h1 className="mb-8 text-5xl leading-tight tracking-tight md:text-6xl lg:text-7xl">
              <span className="font-serif italic text-gray-500">Remember</span>{" "}
              <span className="font-sans font-bold text-gray-900">
                your Mandarin
              </span>
            </h1>
            <p className="mb-6 text-xl leading-relaxed text-gray-700 md:text-2xl">
              Overcome the intermediate plateau with daily review, personalized
              stories, and topic-based vocabulary.
            </p>
            <p className="text-lg leading-relaxed text-gray-600 md:text-xl">
              For A2–B2 (HSK 3-6) learners who keep forgetting the words they
              learn.
            </p>
          </div>

          {/* Right: CTA Boxes */}
          <div className="flex flex-col gap-4 lg:justify-center">
            <HeroCTA />

            <button className="group rounded-xl border border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md">
              <h2 className="mb-3 text-2xl font-bold text-gray-900">
                Chat with Your AI Companion
              </h2>
              <p className="text-base leading-relaxed text-gray-600">
                Practice and improve your Mandarin immediately. Have real
                conversations that build confidence and fluency.
              </p>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
