import Link from "next/link";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white/80 px-6 py-5 backdrop-blur-sm md:px-12">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-lg border-2 border-gray-900 bg-gray-900"></div>
        <span className="text-lg font-semibold text-gray-900">
          Lingo <span className="text-gray-500">Island</span>
        </span>
      </Link>
      <div className="hidden items-center gap-6 text-sm text-gray-600 md:flex">
        <Link href="/#demo" className="hover:text-gray-900">
          Demo
        </Link>
        <Link href="/#how-it-works" className="hover:text-gray-900">
          How it works
        </Link>
        <Link href="/#topics" className="hover:text-gray-900">
          Topics
        </Link>
        <Link href="/#faq" className="hover:text-gray-900">
          FAQ
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          Sign in
        </Link>
        <Link
          href="/onboarding/topic-island"
          className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md"
        >
          Try for free
        </Link>
      </div>
    </nav>
  );
}
