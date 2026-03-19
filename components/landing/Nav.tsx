"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      style={{
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div className="flex items-center justify-between px-6 py-4 md:px-12">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl">
            <Image
              src="/logo.png"
              alt="LingoIsland Logo"
              width={60}
              height={60}
              className="rounded-xl"
            />
          </div>
          <span
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 600,
              color: "#071E2E",
              fontSize: "16px",
            }}
          >
            LingoIsland
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-6 md:flex">
          {[
            { href: "/#why", label: "Why LingoIsland" },
            { href: "/#demo", label: "Demo" },
            { href: "/#how-it-works", label: "How it works" },
            { href: "/#topics", label: "Topics" },
            { href: "/founder", label: "Founder" },
            { href: "/#faq", label: "FAQ" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: "13px",
                color: "#4a7a94",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              className="hover:text-[#071E2E]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            style={{
              fontSize: "13px",
              color: "#071E2E",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 500,
              padding: "6px 12px",
              textDecoration: "none",
              transition: "transform 0.15s",
            }}
            className="hover:-translate-y-px"
          >
            Sign in
          </Link>
          <Link
            href="/onboarding/topic-island"
            style={{
              background: "#071E2E",
              color: "#fff",
              borderRadius: "8px",
              padding: "8px 18px",
              fontSize: "13px",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 500,
              textDecoration: "none",
              transition: "transform 0.15s",
              display: "inline-block",
            }}
            className="hover:-translate-y-px"
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
          <span
            style={{ background: "#071E2E" }}
            className={`h-0.5 w-6 transition-all ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            style={{ background: "#071E2E" }}
            className={`h-0.5 w-6 transition-all ${mobileMenuOpen ? "opacity-0" : ""}`}
          />
          <span
            style={{ background: "#071E2E" }}
            className={`h-0.5 w-6 transition-all ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            borderTop: "1px solid rgba(0,0,0,0.07)",
            background: "#fff",
          }}
          className="md:hidden"
        >
          <div className="flex flex-col px-6 py-4 space-y-4">
            {[
              { href: "/#why", label: "Why LingoIsland" },
              { href: "/#demo", label: "Demo" },
              { href: "/#how-it-works", label: "How it works" },
              { href: "/#topics", label: "Topics" },
              { href: "/founder", label: "Founder" },
              { href: "/#faq", label: "FAQ" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ fontSize: "13px", color: "#4a7a94" }}
                className="hover:text-[#071E2E]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div
              style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}
              className="pt-4 flex flex-col gap-3"
            >
              <Link
                href="/login"
                style={{
                  fontSize: "13px",
                  color: "#071E2E",
                  border: "1px solid rgba(0,0,0,0.15)",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  textAlign: "center",
                  textDecoration: "none",
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/onboarding/topic-island"
                style={{
                  background: "#071E2E",
                  color: "#fff",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: 500,
                  textAlign: "center",
                  textDecoration: "none",
                  display: "block",
                }}
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
