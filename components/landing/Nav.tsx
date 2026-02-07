"use client";

import Link from "next/link";
import AppLogo from "@/components/app/AppLogo";
import { useState } from "react";

export default function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-5 md:px-12">
        <AppLogo
          href="/"
          textClassName="text-xl font-semibold text-gray-900"
        />
        
        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-6 text-sm text-gray-600 md:flex">
          <Link href="/#why" className="hover:text-gray-900">
            Why LingoIsland
          </Link>
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

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
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

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label="Toggle menu"
        >
          <span className={`h-0.5 w-6 bg-gray-900 transition-all ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`h-0.5 w-6 bg-gray-900 transition-all ${mobileMenuOpen ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-6 bg-gray-900 transition-all ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <div className="flex flex-col px-6 py-4 space-y-4">
            <Link 
              href="/#why" 
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              Why LingoIsland
            </Link>
            <Link 
              href="/#demo" 
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              Demo
            </Link>
            <Link 
              href="/#how-it-works" 
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              How it works
            </Link>
            <Link 
              href="/#topics" 
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              Topics
            </Link>
            <Link 
              href="/#faq" 
              className="text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </Link>
            <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-center text-sm font-medium text-gray-700 border border-gray-300 transition-colors hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/onboarding/topic-island"
                className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800"
                onClick={() => setMobileMenuOpen(false)}
              >
                Try for free
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
