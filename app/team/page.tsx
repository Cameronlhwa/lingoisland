"use client";

import Link from "next/link";
import Image from "next/image";
import FadeSectionObserver from "@/components/landing/FadeSectionObserver";
import SectionHeader from "@/components/landing/SectionHeader";
import { FOUNDER_PAGE } from "@/lib/landing-content";
import { motion, useReducedMotion } from "framer-motion";

const FOUNDER_IMAGE = "/founder/cameron-lim-profile.jpg";

const CARD_SHADOW = "0 8px 24px rgba(95,49,25,0.04)";
const SECTION_BG = "var(--lingo-sky-pale)";

export default function TeamPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main>
      <FadeSectionObserver />

      {/* Hero: same cove artwork as the landing page */}
      <section className="marketing-team-hero" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          className="hero-scene-bg"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/onboarding/journey-island-v2.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center bottom",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "48px 24px 24px",
            position: "relative",
            zIndex: 3,
            minHeight: "clamp(420px, 55vh, 580px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "-20px -4% 0",
              zIndex: -1,
              background:
                "radial-gradient(ellipse 70% 58% at 35% 45%, rgba(255,250,243,0.98) 0%, rgba(255,250,243,0.92) 45%, transparent 85%)",
              pointerEvents: "none",
            }}
          />

          <Link
            href="/"
            className="mb-5 inline-flex w-fit items-center gap-2 text-sm font-semibold no-underline transition-colors hover:opacity-80"
            style={{ color: "var(--lingo-text-muted)", fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1
                className="lingo-display"
                style={{
                  fontWeight: 700,
                  fontSize: "clamp(32px, 4.5vw, 48px)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.03em",
                  color: "var(--lingo-navy)",
                  marginBottom: 16,
                }}
              >
                Our Team
              </h1>
              <p
                style={{
                  fontSize: 17.5,
                  color: "var(--lingo-text-muted)",
                  lineHeight: 1.65,
                  maxWidth: 520,
                  marginBottom: 28,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                Two Mandarin learners. One shared goal: make the language you need easier to learn, remember, and use. Cameron builds LingoIsland; Sherly shapes how it teaches.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link className="marketing-cta-link" href={FOUNDER_PAGE.hero.ctaPrimary.href}>
                  {FOUNDER_PAGE.hero.ctaPrimary.label}
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-[3px]">
                    →
                  </span>
                </Link>
                <Link href="#team-members" className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold no-underline" style={{color:"var(--lingo-navy)",borderColor:"var(--lingo-border)",background:"var(--lingo-page-bg)"}}>
                  Meet Cameron &amp; Sherly <span aria-hidden>↓</span>
                </Link>
              </div>
            </motion.div>

            <div className="grid w-full max-w-sm gap-3 lg:w-80" aria-label="Meet the team">
              <Link href="#cameron" className="flex items-center gap-4 rounded-2xl border p-4 no-underline transition-transform hover:-translate-y-0.5" style={{background:"var(--lingo-page-bg)",borderColor:"var(--lingo-border)"}}>
                <Image src={FOUNDER_IMAGE} alt="Cameron" width={64} height={64} className="h-16 w-16 rounded-2xl object-cover" />
                <div><p className="lingo-display text-xl font-bold" style={{color:"var(--lingo-navy)"}}>Cameron</p><p className="mt-1 text-sm" style={{color:"var(--lingo-text-muted)"}}>Founder, Product &amp; Engineering</p></div>
              </Link>
              <Link href="#sherly" className="flex items-center gap-4 rounded-2xl border p-4 no-underline transition-transform hover:-translate-y-0.5" style={{background:"var(--lingo-page-bg)",borderColor:"var(--lingo-border)"}}>
                <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-2xl"><Image src="/founder/sherly-profile.jpg" alt="Sherly" fill sizes="128px" quality={90} className="object-cover" style={{transform:"scale(2)",transformOrigin:"0% 24%"}} /></span>
                <div><p className="lingo-display text-xl font-bold" style={{color:"var(--lingo-navy)"}}>Sherly</p><p className="mt-1 text-sm" style={{color:"var(--lingo-text-muted)"}}>Course Design &amp; Teaching</p></div>
              </Link>
            </div>
          </div>
        </div>

        <div
          aria-hidden
          style={{
            position: "relative",
            zIndex: 2,
            height: 120,
            marginTop: -60,
            background:
              "linear-gradient(to bottom, rgba(255,250,243,0) 0%, rgba(255,250,243,0.86) 60%, #fffaf3 100%)",
          }}
        />
      </section>

      <div id="team-members" className="scroll-mt-24">
        <section id="cameron" className="fade-section scroll-mt-24 px-6 py-20 md:py-24" style={{background: SECTION_BG}}>
          <div className="mx-auto max-w-[960px]">
            <SectionHeader eyebrow="Founder, Product & Engineering" title="Cameron" subtitle="The Mandarin learner building LingoIsland from idea to product." align="left" />
            <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-5 text-base leading-relaxed" style={{color:"var(--lingo-text-muted)",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
                <p>Cameron studies Computer Engineering at the University of Waterloo, one of the world’s leading universities for engineering and computer science. He brings that technical foundation to LingoIsland, leading the engineering, design, and development of the product as a whole.</p>
                <p>The idea grew out of his own experience learning Mandarin. Making Chinese friends at university showed him the gap between textbook knowledge and everyday conversation: the vocabulary, expressions, and slang that help people connect.</p>
                <p>He built LingoIsland to close that gap, helping learners focus on Mandarin that matters to their lives. His Chinese friends have been involved from the start, helping keep the language authentic and grounded in how people actually speak.</p>
                <p>At LingoIsland, Cameron turns that vision into the learning experience, from how the site looks and feels to the systems that make it work. Working with Sherly on how lessons are taught, he brings the product together and keeps improving it around learners’ needs.</p>
                <p>Outside LingoIsland, Cameron shares study vlogs and his experience as a university student on YouTube. His interest in learning and building good study habits also informs how he approaches the product.</p>
                <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
                  <a href="https://www.youtube.com/@cameronlim" target="_blank" rel="noopener noreferrer" className="font-bold underline-offset-4 hover:underline" style={{color:"var(--lingo-teal)"}}>Cameron on YouTube ↗</a>
                  <a href="https://www.instagram.com/cameronlhwa/" target="_blank" rel="noopener noreferrer" className="font-bold underline-offset-4 hover:underline" style={{color:"var(--lingo-teal)"}}>Instagram ↗</a>
                </div>
              </div>
              <aside className="self-start rounded-3xl border p-7" style={{background:"var(--lingo-page-bg)",borderColor:"var(--lingo-border)"}}>
                <h3 className="lingo-display text-xl font-bold" style={{color:"var(--lingo-navy)"}}>From idea to learning experience</h3>
                <ul className="mt-5 space-y-5 text-sm leading-relaxed" style={{color:"var(--lingo-text-muted)"}}>
                  <li><strong className="mb-1 block" style={{color:"var(--lingo-navy)"}}>Technical development</strong>Building the software and systems that bring LingoIsland’s learning approach to life.</li>
                  <li><strong className="mb-1 block" style={{color:"var(--lingo-navy)"}}>Product and design</strong>Shaping a clear, approachable experience that makes it easy to focus on learning.</li>
                  <li><strong className="mb-1 block" style={{color:"var(--lingo-navy)"}}>Continual improvement</strong>Turning learner feedback and teaching ideas into practical improvements across the product.</li>
                </ul>
                <a href="https://uwaterloo.ca/engineering/news/waterloo-climbs-38th-qs-world-subject-rankings" target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-sm font-semibold underline underline-offset-4" style={{color:"var(--lingo-teal)"}}>About Waterloo Engineering ↗</a>
              </aside>
            </div>
          </div>
        </section>
      </div>

      <section id="sherly" className="fade-section scroll-mt-24 px-6 py-20 md:py-24" style={{background:"var(--lingo-page-bg)"}}>
        <div className="mx-auto max-w-[960px]">
          <SectionHeader eyebrow="Course Design & Teaching" title="Sherly" subtitle="The learner and educator behind The Mandarin Path." align="left" />
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-5 text-base leading-relaxed" style={{color:"var(--lingo-text-muted)",fontFamily:"'DM Sans', system-ui, sans-serif"}}>
              <p>Sherly began learning Mandarin before university and went on to develop native-level fluency. Having learned the language herself, she understands the work behind that progress and how much difference clear explanations and well-structured practice can make.</p>
              <p>She has also studied toward CTCSOL, the Certificate for Teachers of Chinese to Speakers of Other Languages. This professional teaching certificate assesses the knowledge and skills involved in teaching Chinese to learners of other languages.</p>
              <p>At LingoIsland, Sherly leads course structure and teaching design: deciding how lessons build on each other, how new language is introduced, and how practice helps it stick. She continually refines the approach to make learning more effective and make better use of each learner’s time.</p>
              <p>Outside LingoIsland, she creates Mandarin-learning content as <strong style={{color:"var(--lingo-navy)"}}>@themandarinpath</strong>, sharing the language with learners through social media. Her experience as both a learner and a creator brings a practical, approachable perspective to our lessons.</p>
              <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
                <a href="https://www.instagram.com/themandarinpath/" target="_blank" rel="noopener noreferrer" className="font-bold underline-offset-4 hover:underline" style={{color:"var(--lingo-teal)"}}>The Mandarin Path on Instagram ↗</a>
                <a href="https://www.tiktok.com/@themandarinpath" target="_blank" rel="noopener noreferrer" className="font-bold underline-offset-4 hover:underline" style={{color:"var(--lingo-teal)"}}>TikTok ↗</a>
              </div>
            </div>
            <aside className="self-start rounded-3xl border p-7" style={{background:"var(--lingo-sky-pale)",borderColor:"var(--lingo-border)"}}>
              <h3 className="lingo-display text-xl font-bold" style={{color:"var(--lingo-navy)"}}>A clear path from learning to using</h3>
              <ul className="mt-5 space-y-5 text-sm leading-relaxed" style={{color:"var(--lingo-text-muted)"}}>
                <li><strong className="mb-1 block" style={{color:"var(--lingo-navy)"}}>Thoughtful course structure</strong>Lessons that build on what you already know, with a clear purpose for each new word and expression.</li>
                <li><strong className="mb-1 block" style={{color:"var(--lingo-navy)"}}>Practice that supports retention</strong>Opportunities to recall and reuse Mandarin, so progress goes beyond recognizing an answer.</li>
                <li><strong className="mb-1 block" style={{color:"var(--lingo-navy)"}}>Teaching that keeps improving</strong>Refining explanations, lesson order, and practice around what helps learners understand and move forward.</li>
              </ul>
              <a href="https://ci.ac.nz/exams/ctcsol/" target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-sm font-semibold underline underline-offset-4" style={{color:"var(--lingo-teal)"}}>About the CTCSOL qualification ↗</a>
            </aside>
          </div>
        </div>
      </section>

      {/* How I build */}
      <section className="fade-section" style={{ background: SECTION_BG, padding: "100px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <SectionHeader eyebrow="Principles" title="How we build and teach" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FOUNDER_PAGE.principles.items.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.04 }}
                whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid var(--lingo-border)",
                  borderRadius: 20,
                  padding: 22,
                  boxShadow: CARD_SHADOW,
                }}
              >
                <h3
                  className="lingo-display text-base font-semibold"
                  style={{ color: "var(--lingo-navy)" }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{
                    color: "var(--lingo-text-muted)",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {item.line}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-team-cta">
        <h2>Learn Mandarin you can actually use</h2>
        <p>Build a personalized learning plan around your work, studies, and real life. See your plan before choosing a membership.</p>
        <Link className="marketing-cta-link" href="/onboarding/journey">Build my learning plan</Link>
      </section>

    </main>
  );
}
