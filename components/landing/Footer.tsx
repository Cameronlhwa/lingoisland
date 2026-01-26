import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-900 px-6 py-12 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-white">
          <div className="h-7 w-7 rounded-lg border-2 border-white bg-white/10" />
          <span className="text-lg font-semibold">LingoIsland</span>
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <Link href="/#topics" className="hover:text-white">
            Topics
          </Link>
          <Link href="/login" className="hover:text-white">
            Sign in
          </Link>
          <Link href="/onboarding/topic-island" className="hover:text-white">
            Create Topic Island
          </Link>
        </div>
      </div>
    </footer>
  );
}
