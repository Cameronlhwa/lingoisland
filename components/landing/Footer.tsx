import Link from "next/link";
import { loginHrefForLanding } from "@/lib/utils/app-side";
import HomeWordmark from "./HomeWordmark";

export default function Footer({
  track = "islands",
}: {
  /** HSK prep landing uses /hsk/app after sign-in. */
  track?: "islands" | "hsk";
}) {
  const signInHref = loginHrefForLanding(track === "hsk" ? "/hskprep" : "/");
  return (
    <footer
      className="px-6 md:px-12"
      style={{
        background: "var(--lingo-page-bg, #fff)",
        borderTop: "1px solid var(--lingo-border)",
        paddingTop: 36,
        paddingBottom: 36,
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
        <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <HomeWordmark height={44} />
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
