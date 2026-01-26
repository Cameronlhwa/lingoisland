import { LEARNER_BULLETS } from "@/lib/landing-content";

export default function SocialProof() {
  return (
    <section className="border-b border-gray-100 bg-white px-6 py-20 md:px-12">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
              Built for learners who want real-life Mandarin
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              LingoIsland is focused on usable vocabulary and believable
              sentences, not flashy claims.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <ul className="space-y-3 text-sm text-gray-700">
              {LEARNER_BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-gray-900" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
