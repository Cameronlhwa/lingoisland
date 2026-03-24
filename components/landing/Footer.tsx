import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer
      style={{
        background: "#071E2E",
        padding: "32px 48px",
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
              color: "#fff",
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
            { href: "/#topics", label: "Topics" },
            { href: "/founder", label: "Founder" },
            { href: "/login", label: "Sign in" },
            { href: "/onboarding/journey", label: "Create Topic Island" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.5)",
                textDecoration: "none",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                transition: "color 0.15s",
              }}
              className="hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
