import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-900 px-6 py-16 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          {/* Left: Final CTA */}
          <div>
            <h2 className="mb-6 font-serif text-4xl font-normal italic text-white md:text-5xl">
              Start free
            </h2>
            <p className="mb-8 text-xl text-gray-300">
              Build your first topic island today.
            </p>
            <Link
              href="/onboarding/topic-island"
              className="inline-block rounded-lg border border-white bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-sm transition-all hover:bg-gray-100 hover:shadow-md"
            >
              Try for free
            </Link>
          </div>

          {/* Right: Links */}
          <div className="flex flex-col gap-6 md:flex-row md:gap-12">
            <div className="flex flex-col gap-3">
              <a
                href="#"
                className="text-base text-gray-300 transition-colors hover:text-white"
              >
                Home
              </a>
              <a
                href="#"
                className="text-base text-gray-300 transition-colors hover:text-white"
              >
                Examples
              </a>
              <a
                href="#"
                className="text-base text-gray-300 transition-colors hover:text-white"
              >
                Privacy Policy
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <a
                href="#"
                className="text-base text-gray-300 transition-colors hover:text-white"
              >
                Help Center
              </a>
              <a
                href="#"
                className="text-base text-gray-300 transition-colors hover:text-white"
              >
                Terms of Service
              </a>
              <a
                href="#"
                className="text-base text-gray-300 transition-colors hover:text-white"
              >
                Pricing
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
