import Link from "next/link";
import Image from "next/image";
import { loginHrefForLanding } from "@/lib/utils/app-side";

export default function Footer({
  track = "islands",
}: {
  /** HSK prep landing uses /hsk/app after sign-in. */
  track?: "islands" | "hsk";
}) {
  const signInHref = loginHrefForLanding(track === "hsk" ? "/hskprep" : "/");
  return (
    <footer
      style={{
        background: "#fff",
        borderTop: "1px solid var(--lingo-border)",
        padding: "36px 48px",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              overflow: "hidden",
              background: "#fff",
              padding: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src="/logo.png"
              alt="LingoIsland Logo"
              width={28}
              height={28}
              style={{ borderRadius: 6 }}
            />
          </div>
          <span
            style={{
              color: "var(--lingo-navy)",
              fontWeight: 600,
              fontSize: 15,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            LingoIsland
          </span>
        </Link>

        {/* Links */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
          {[
            { href: "/", label: "Home" },
            { href: "/blog", label: "Blog" },
            { href: "/#topics", label: "Topics" },
            { href: "/founder", label: "Founder" },
            { href: "/contact", label: "Contact" },
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/terms", label: "Terms of Service" },
            { href: signInHref, label: "Sign in" },
            { href: "/onboarding/journey", label: "Create Topic Island" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: 13,
                color: "var(--lingo-text-muted)",
                textDecoration: "none",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 600,
                transition: "color 0.15s",
              }}
              className="hover:text-[var(--lingo-navy)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
