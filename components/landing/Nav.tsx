"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PrimaryButton from "./PrimaryButton";
import { loginHrefForLanding } from "@/lib/utils/app-side";

const LINKS = [
  { href: "/#why", label: "Why LingoIsland" },
  { href: "/#demo", label: "Demo" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#topics", label: "Topics" },
  { href: "/blog", label: "Blog" },
  { href: "/founder", label: "Founder" },
  { href: "/#faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
];

export default function Nav() {
  const pathname = usePathname();
  const signInHref = loginHrefForLanding(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        boxShadow: scrolled ? "0 8px 30px rgba(33,95,120,0.07)" : "none",
        transition: "background 0.25s ease, box-shadow 0.25s ease",
      }}
    >
      <div
        className="flex items-center justify-between px-6 md:px-12"
        style={{ height: 74 }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
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
            className="lingo-display"
            style={{
              fontWeight: 700,
              color: "var(--lingo-navy)",
              fontSize: "17px",
            }}
          >
            LingoIsland
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative"
              style={{
                fontSize: "13.5px",
                color: "var(--lingo-text-muted)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 600,
                textDecoration: "none",
                transition: "color 0.15s",
                paddingBottom: 4,
              }}
            >
              <span className="transition-colors duration-150 group-hover:text-[var(--lingo-teal)]">
                {link.label}
              </span>
              <span
                aria-hidden
                className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full transition-all duration-200 group-hover:w-full"
                style={{ background: "var(--lingo-teal)" }}
              />
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-4 md:flex">
          <Link
            href={signInHref}
            style={{
              fontSize: "13.5px",
              color: "var(--lingo-navy)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 700,
              padding: "6px 12px",
              textDecoration: "none",
              transition: "transform 0.15s, color 0.15s",
            }}
            className="hover:-translate-y-px hover:text-[var(--lingo-teal)]"
          >
            Sign in
          </Link>
          <PrimaryButton href="/onboarding/journey" size="compact">
            Try for free
          </PrimaryButton>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <span
            style={{ background: "var(--lingo-navy)" }}
            className={`h-0.5 w-6 rounded-full transition-all ${mobileMenuOpen ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            style={{ background: "var(--lingo-navy)" }}
            className={`h-0.5 w-6 rounded-full transition-all ${mobileMenuOpen ? "opacity-0" : ""}`}
          />
          <span
            style={{ background: "var(--lingo-navy)" }}
            className={`h-0.5 w-6 rounded-full transition-all ${mobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden"
          style={{
            margin: "0 12px 12px",
            borderRadius: 24,
            background: "var(--lingo-cream)",
            boxShadow: "0 20px 48px rgba(44,105,128,0.16)",
            overflow: "hidden",
          }}
        >
          <div className="flex flex-col px-6 py-5 space-y-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: "14.5px",
                  color: "var(--lingo-navy)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 600,
                  padding: "10px 4px",
                  borderRadius: 12,
                  transition: "background 0.15s, color 0.15s",
                }}
                className="hover:bg-[rgba(89,198,222,0.1)] hover:text-[var(--lingo-teal)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <Link
                href={signInHref}
                style={{
                  fontSize: "14px",
                  color: "var(--lingo-navy)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 700,
                  border: "1px solid rgba(67,146,172,0.2)",
                  borderRadius: 14,
                  padding: "10px 18px",
                  textAlign: "center",
                  textDecoration: "none",
                }}
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
              <PrimaryButton
                href="/onboarding/journey"
                className="w-full"
                style={{ display: "flex" }}
              >
                Try for free
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
