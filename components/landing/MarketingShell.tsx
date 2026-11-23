"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import HomeWordmark from "./HomeWordmark";
import styles from "./MarketingShell.module.css";

const links = [
  { href: "/team", label: "Our Team" },
  { href: "/blog", label: "Blog" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];
export default function MarketingShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown",close); document.addEventListener("pointerdown",outside);
    return () => { document.removeEventListener("keydown",close); document.removeEventListener("pointerdown",outside); };
  },[open]);
  return <div className={styles.site}>
    <a href="#marketing-content" className={styles.skip}>Skip to content</a>
    <header ref={header} className={styles.header}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" aria-label="LingoIsland home"><HomeWordmark height={49} /></Link>
        <div className={styles.desktop}>
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#topics">Explore topics</Link>
          <Link href="/#pronunciation">Pronunciation Academy</Link>
          <Link href="/login?next=%2Fapp" className={styles.login}>Log in</Link>
        </div>
        <button ref={toggle} className={styles.toggle} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="marketing-menu" aria-label={open ? "Close menu" : "Open menu"}>{open ? <X aria-hidden /> : <Menu aria-hidden />}</button>
      </nav>
      {open && <nav id="marketing-menu" className={styles.mobile} aria-label="Mobile navigation">
        <Link href="/#how-it-works">How it works</Link><Link href="/#topics">Explore topics</Link><Link href="/#pronunciation">Pronunciation Academy</Link>
        {links.map(link=><Link key={link.href} href={link.href} aria-current={path===link.href ? "page" : undefined}>{link.label}</Link>)}
        <Link href="/login?next=%2Fapp">Log in</Link>
      </nav>}
    </header>
    <div id="marketing-content" className={styles.content} tabIndex={-1}>{children}</div>
    <footer className={styles.footer}>
      <Link href="/" aria-label="LingoIsland home"><HomeWordmark height={44} /></Link>
      <nav aria-label="Footer navigation">{links.map(link=><Link key={link.href} href={link.href} aria-current={path===link.href || (link.href==="/blog" && path.startsWith("/blog/")) ? "page" : undefined}>{link.label}</Link>)}</nav>
      <p>Mandarin for the life you want to live.</p>
    </footer>
  </div>;
}
