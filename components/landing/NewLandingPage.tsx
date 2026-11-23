"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Menu,
  Mic,
  Play,
  Plus,
  Volume2,
  X,
} from "lucide-react";
import TopicConversation, { type ConversationTopic } from "./TopicConversation";
import PronunciationPreview from "./PronunciationPreview";
import HomeWordmark from "./HomeWordmark";
import LandingWaveTransition from "./LandingWaveTransition";
import styles from "./NewLandingPage.module.css";

const A = "/home/redesign-v2";
const PLAN = "/onboarding/journey";
const ACADEMY = "/app/pronunciation/learn";
const PRACTICE = "/app/pronunciation/practice";
const NAV = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Explore topics", href: "#topics" },
  { label: "Pronunciation Academy", href: "#pronunciation" },
];

function PlanLink({
  children = "Build My First Plan",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={PLAN} className={`${styles.primary} ${className}`}>
      {children}
    </Link>
  );
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <header ref={header} className={styles.header}>
      <nav
        className={`${styles.container} ${styles.nav}`}
        aria-label="Main navigation"
      >
        <Link href="/" aria-label="LingoIsland home">
          <HomeWordmark height={49} />
        </Link>
        <div className={styles.desktopLinks}>
          {NAV.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <Link href="/login?next=%2Fapp" className={styles.login}>
            Log in
          </Link>
        </div>
        <button
          className={styles.menuButton}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="home-mobile-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      {open && (
        <nav
          id="home-mobile-menu"
          aria-label="Mobile navigation"
          className={styles.mobileMenu}
        >
          {NAV.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <Link href="/team">Our Team</Link>
          <Link href="/login?next=%2Fapp">Log in</Link>
          <PlanLink />
        </nav>
      )}
    </header>
  );
}

function HeroArt() {
  const layers = [
    "01_sand",
    "02_palm_plants",
    "03_capy_book",
    "04_foreground_oranges",
    "05_shells_starfish",
  ];
  return (
    <div
      className={styles.heroArt}
      role="img"
      aria-label="A happy capybara reading a green book under a palm tree, with oranges and seashells on the sand."
    >
      {layers.map((layer, i) => (
        <div key={layer} className={styles.heroLayer} data-hero-layer={i}>
          <Image
            src={`${A}/hero/${layer}.webp`}
            alt=""
            fill
            priority
            sizes="(max-width: 700px) 94vw, (max-width: 1100px) 54vw, 650px"
          />
        </div>
      ))}
    </div>
  );
}

const TOPICS = [
  {
    title: "Family & Heritage",
    goal: "heritage",
    question:
      "Who would you love to feel closer to in Mandarin, and what would you like to talk about together?",
    placeholder: "e.g. Chatting with my grandparents",
    reply:
      "Cool! Let’s make room for the family conversations that matter to you.",
    examples: ["Family conversations", "Traditions", "Your roots"],
    description: "Talk about family, traditions and culture.",
    file: "02_topic_family_heritage",
    topic: "relationships-dating",
    size: 1.1,
  },
  {
    title: "Travel & Adventure",
    goal: "travel",
    question:
      "Where would you love to go, and what would you like to feel confident doing in Mandarin?",
    placeholder: "e.g. Ordering street food in Taipei",
    reply:
      "Cool! Let’s build your Mandarin around the adventures you have in mind.",
    examples: ["Meeting locals", "Getting around", "Hidden gems"],
    description: "Plan trips, ask for directions and get around with ease.",
    file: "03_topic_travel_adventure",
    topic: "travel-getting-around",
    size: 1.2,
  },
  {
    title: "Work & Career",
    goal: "work",
    question:
      "What do you do, and which work conversations would you love to handle confidently in Mandarin?",
    placeholder: "e.g. Introducing my designs to clients",
    reply: "Cool! Let’s focus on Mandarin you can bring into your working day.",
    examples: ["Meetings", "Networking", "Client conversations"],
    description: "Communicate in a professional setting.",
    file: "04_topic_work_career",
    topic: "work-office-mandarin",
    size: 1.05,
  },
  {
    title: "Food & Lifestyle",
    goal: "everyday",
    question:
      "What are you into? Cooking, cafés, hobbies? Tell me what you’d love to chat about in Mandarin.",
    placeholder: "e.g. Talking about recipes with friends",
    reply:
      "Cool! Let’s turn the things you enjoy into Mandarin you’ll actually use.",
    examples: ["Ordering favorites", "Hobbies", "Everyday conversations"],
    description: "Talk about food, daily life and hobbies.",
    file: "05_topic_food_lifestyle",
    topic: "food-cooking",
    size: 1.05,
  },
];

function TopicSection() {
  const [selected, setSelected] = useState<ConversationTopic | null>(null);
  const topicTrigger = useRef<HTMLButtonElement | null>(null);
  return (
    <section
      className={`${styles.container} ${styles.topics}`}
      id="topics"
      aria-labelledby="topics-title"
    >
      <div className={styles.sectionIntro}>
        <h2 id="topics-title">Learn Mandarin you can actually use.</h2>
        <p>
          Explore ready-made topics or create your own. We’ll turn your
          interests into structured learning journeys built around practical
          vocabulary and real-life situations, one stage at a time.
        </p>
      </div>
      <div className={styles.topicGrid}>
        {TOPICS.map((topic) => (
          <button
            type="button"
            onClick={(event) => {
              topicTrigger.current = event.currentTarget;
              setSelected(topic);
            }}
            aria-haspopup="dialog"
            key={topic.file}
            className={styles.topicCard}
            style={{
              width: "100%",
              textAlign: "left",
              font: "inherit",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <div className={styles.topicArt}>
              <Image
                src={`${A}/${topic.file}.webp`}
                alt=""
                width={140}
                height={140}
                sizes="140px"
                style={{ transform: `scale(${topic.size})` }}
              />
            </div>
            <div>
              <h3>{topic.title}</h3>
              <p>{topic.description}</p>
            </div>
            <span className={styles.topicArrow}>
              <ArrowRight size={18} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
      <div className={styles.center}>
        <button
          type="button"
          className={styles.secondary}
          aria-haspopup="dialog"
          onClick={(event) => {
            topicTrigger.current = event.currentTarget;
            setSelected({
              title: "Your own topic",
              description: "Make Mandarin part of something you love.",
              file: "",
              goal: "other",
              question:
                "If you could have a conversation about anything in Mandarin, what would you choose? Tell me what you’re into.",
              placeholder: "e.g. Basketball, pottery, or my next trip",
              reply:
                "Cool! Let’s turn your interests into a Mandarin journey that feels like you.",
              examples: ["Your passions", "Your goals", "Your everyday life"],
            });
          }}
        >
          <Plus size={20} aria-hidden="true" /> Create your own topic
        </button>
      </div>
      {selected && (
        <TopicConversation
          key={selected.title}
          topic={selected}
          onClose={() => {
            setSelected(null);
            requestAnimationFrame(() => topicTrigger.current?.focus());
          }}
        />
      )}
    </section>
  );
}

// Source PNGs retain different transparent padding. Map their card faces into
// equal wrappers so their optical sizes match without stretching the artwork.
const CARDS = [
  {
    file: "01_grammar_context_card",
    revision: "pinyin-corrected-20261121",
    label:
      "Grammar in context: 我喜欢旅行。 Wǒ xǐhuān lǚxíng. I like traveling.",
    width: 1060,
    height: 1484,
    x: 91,
    y: 139,
    faceWidth: 878,
    faceHeight: 1241,
  },
  {
    file: "02_practice_card",
    label: "Practice: complete 我喜欢 blank with 旅行, meaning traveling.",
    width: 1254,
    height: 1254,
    x: 229,
    y: 102,
    faceWidth: 792,
    faceHeight: 1075,
  },
  {
    file: "03_story_card",
    label:
      "Story preview with a watercolor Chinese pagoda and three story sections.",
    width: 1060,
    height: 1484,
    x: 123,
    y: 177,
    faceWidth: 814,
    faceHeight: 1134,
  },
];

// Each later card slides from behind Grammar into its existing resting position.
const CARD_REVEALS = [
  { start: 0, end: 0.24, x: "0%", y: 36, fromAngle: -4, angle: -8 },
  { start: 0.18, end: 0.62, x: "-94.444%", y: 26, fromAngle: -6, angle: 0 },
  { start: 0.46, end: 0.96, x: "-188.889%", y: 38, fromAngle: -6, angle: 8 },
];

function LessonCard({
  card,
  index,
  progress,
  reduced,
}: {
  card: (typeof CARDS)[number];
  index: number;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const reveal = CARD_REVEALS[index];
  const range = [reveal.start, reveal.end];
  const x = useTransform(progress, range, [reveal.x, "0%"]);
  const y = useTransform(progress, range, [reveal.y, 0]);
  const rotate = useTransform(progress, range, [
    reveal.fromAngle,
    reveal.angle,
  ]);
  const opacity = useTransform(
    progress,
    [reveal.start, reveal.start + (reveal.end - reveal.start) * 0.3],
    [0, 1],
  );

  return (
    <motion.div
      className={`${styles.lessonCard} ${styles[`card${index}`]}`}
      data-lesson-card={index}
      initial={false}
      style={{
        x: reduced ? 0 : x,
        y: reduced ? 0 : y,
        rotate: reduced ? reveal.angle : rotate,
        opacity: reduced ? 1 : opacity,
      }}
    >
      <Image
        src={`${A}/cards/${card.file}.webp${card.revision ? `?v=${card.revision}` : ""}`}
        alt={card.label}
        width={card.width}
        height={card.height}
        sizes="(max-width: 600px) 44vw, 300px"
        className={styles.cardImage}
        style={{
          width: `${(card.width / card.faceWidth) * 100}%`,
          height: `${(card.height / card.faceHeight) * 100}%`,
          maxWidth: "none",
          left: `${(-card.x / card.faceWidth) * 100}%`,
          top: `${(-card.y / card.faceHeight) * 100}%`,
        }}
      />
    </motion.div>
  );
}

function LessonCards() {
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: stage,
    offset: ["start 90%", "center 58%"],
  });

  return (
    <div ref={stage} className={styles.lessonCards} data-lesson-sequence>
      {CARDS.map((card, index) => (
        <LessonCard
          key={card.file}
          card={card}
          index={index}
          progress={scrollYProgress}
          reduced={Boolean(reduced)}
        />
      ))}
    </div>
  );
}

function speak(text: string, onUnavailable: () => void) {
  if (!("speechSynthesis" in window)) {
    onUnavailable();
    return;
  }
  window.speechSynthesis.cancel();
  const voice = new SpeechSynthesisUtterance(text);
  voice.lang = "zh-CN";
  voice.rate = 0.8;
  voice.onerror = onUnavailable;
  const chinese = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith("zh"));
  if (chinese) voice.voice = chinese;
  window.speechSynthesis.speak(voice);
}

function LessonPreview() {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState(0);
  const [audioMessage, setAudioMessage] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const steps = ["Learn the pattern", "Make it useful", "Try it yourself"];
  function close() {
    dialog.current?.close();
    window.speechSynthesis?.cancel();
  }
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const restore = () => {
      document.body.style.overflow = "";
      window.speechSynthesis?.cancel();
      opener.current?.focus();
    };
    element.addEventListener("close", restore);
    return () => {
      element.removeEventListener("close", restore);
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <section
      className={`${styles.container} ${styles.videoSection}`}
      id="demo"
      aria-labelledby="video-title"
    >
      <button
        ref={opener}
        className={styles.videoPoster}
        aria-labelledby="poster-label poster-phrase poster-caption"
        aria-haspopup="dialog"
        onClick={() => {
          setStep(0);
          setAnswer(null);
          setAudioMessage("");
          dialog.current?.showModal();
          document.body.style.overflow = "hidden";
        }}
      >
        <Image
          src={`${A}/11_video_poster_concept.webp`}
          alt="A learner using her phone outside a tea shop."
          width={1672}
          height={941}
          sizes="(max-width: 1100px) 92vw, 1080px"
        />
        <span id="poster-label" className={styles.posterBadge}>
          Lesson preview
        </span>
        <span className={styles.play}>
          <Play fill="currentColor" aria-hidden="true" />
        </span>
        <span id="poster-phrase" className={styles.phraseBubble}>
          <span lang="zh-CN">我想要…</span>
          <small>I’d like…</small>
        </span>
        <span id="poster-caption" className={styles.posterCaption}>
          An everyday example: ordering a drink.
        </span>
      </button>
      <p className={styles.conceptNote}>
        Video concept · Explore a sample lesson
      </p>
      <div className={styles.videoCopy}>
        <h2 id="video-title">Learn it. Say it. Use it.</h2>
      </div>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="lesson-preview-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={styles.dialogContent}>
          <button
            className={styles.closeDialog}
            onClick={close}
            aria-label="Close sample lesson"
          >
            <X />
          </button>
          <p className={styles.eyebrow}>A little taste of LingoIsland</p>
          <h2 id="lesson-preview-title">Your next milk tea, in Mandarin.</h2>
          <div className={styles.stepTabs} aria-label="Lesson steps">
            {steps.map((label, i) => (
              <button
                key={label}
                aria-current={step === i ? "step" : undefined}
                onClick={() => {
                  setStep(i);
                  setAudioMessage("");
                }}
              >
                {i + 1}
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className={styles.lessonPanel}>
            {step === 0 && (
              <>
                <p>Start with a pattern you can use again and again.</p>
                <strong lang="zh-CN">我想要…</strong>
                <span>Wǒ xiǎng yào…</span>
                <b>I’d like…</b>
                <p>Use it to ask for something, from a drink to a menu.</p>
              </>
            )}
            {step === 1 && (
              <>
                <p>Put it together with something you want.</p>
                <strong lang="zh-CN">我想要一杯奶茶。</strong>
                <span>Wǒ xiǎng yào yì bēi nǎichá.</span>
                <b>I’d like a milk tea.</b>
                <div className={styles.vocab}>
                  <span>一杯 · a cup of</span>
                  <span>奶茶 · milk tea</span>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <p>How would you say “I’d like a milk tea”?</p>
                <div className={styles.answerOptions}>
                  {["我想要一杯奶茶。", "我喜欢旅行。"].map((value) => (
                    <button
                      key={value}
                      lang="zh-CN"
                      className={answer === value ? styles.selectedAnswer : ""}
                      onClick={() => setAnswer(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p role="status" className={styles.answerFeedback}>
                  {answer === "我想要一杯奶茶。"
                    ? "That’s it! Now try saying it aloud."
                    : answer
                      ? "That means “I like traveling.” Try the other sentence."
                      : "Choose a sentence."}
                </p>
              </>
            )}
          </div>
          <button
            className={styles.listenButton}
            onClick={() =>
              speak(step === 0 ? "我想要" : "我想要一杯奶茶", () =>
                setAudioMessage(
                  "Audio isn’t available in this browser. You can still follow the pinyin above.",
                ),
              )
            }
          >
            <Volume2 size={20} /> Listen in Mandarin
          </button>
          <p className={styles.audioMessage} role="status">
            {audioMessage}
          </p>
          <div className={styles.dialogActions}>
            {step < 2 ? (
              <button
                className={styles.primary}
                onClick={() => {
                  setStep(step + 1);
                  setAudioMessage("");
                }}
              >
                Continue
              </button>
            ) : (
              <PlanLink>Build my learning plan</PlanLink>
            )}
          </div>
        </div>
      </dialog>
    </section>
  );
}

function Huahua() {
  const chat = useRef<HTMLDivElement>(null);
  const inView = useInView(chat, { once: true, amount: 0.4 });
  const reducedMotion = useReducedMotion();
  // Even stages type for two seconds; odd stages reveal the next message.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!inView || stage >= 5) return;
    const timer = window.setTimeout(
      () => setStage((current) => current + 1),
      stage % 2 === 0 ? 2000 : 350,
    );
    return () => window.clearTimeout(timer);
  }, [inView, stage]);
  const messages = ["你会做饭吗？", "我会做饭。", "太好了！你喜欢做什么菜？"];
  return (
    <section
      className={`${styles.container} ${styles.huahuaSection}`}
      aria-labelledby="huahua-title"
    >
      <div className={styles.huahuaBand}>
        <div className={styles.chatScene}>
          <div
            ref={chat}
            className={styles.chatCard}
            role="log"
            aria-label="Example conversation with Huahua"
            aria-live="polite"
          >
            <div className={styles.chatHeader}>
              <span /> Huahua
            </div>
            {messages.map((message, index) => {
              const typing = stage === index * 2;
              const shown = stage >= index * 2;
              const user = index === 1;
              return (
                <div
                  key={message}
                  className={`${styles.chatLine} ${user ? styles.userChat : ""}`}
                  style={{
                    visibility: shown ? "visible" : "hidden",
                    minHeight: 40,
                  }}
                  aria-hidden={!shown}
                >
                  {!user && (
                    <Image
                      src={`${A}/08_huahua_buddy.webp`}
                      alt=""
                      width={36}
                      height={36}
                    />
                  )}
                  <motion.span
                    key={typing ? "typing" : "message"}
                    className={typing ? styles.huahuaTyping : undefined}
                    lang={typing ? undefined : "zh-CN"}
                    aria-label={
                      typing
                        ? `${user ? "Learner" : "Huahua"} is typing`
                        : undefined
                    }
                    initial={{
                      opacity: 0,
                      scale: reducedMotion ? 1 : 0.8,
                      y: reducedMotion ? 0 : 8,
                    }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                    style={{
                      transformOrigin: user ? "bottom right" : "bottom left",
                    }}
                  >
                    {typing ? (
                      <>
                        <i />
                        <i />
                        <i />
                      </>
                    ) : (
                      message
                    )}
                  </motion.span>
                </div>
              );
            })}
          </div>
          <Image
            className={styles.huahuaMascot}
            src={`${A}/08_huahua_buddy.webp`}
            alt="Huahua, a friendly waving capybara."
            width={1254}
            height={1254}
            sizes="(max-width: 700px) 34vw, 200px"
          />
        </div>
        <div className={styles.huahuaCopy}>
          <h2 id="huahua-title">
            Meet Huahua, your Mandarin buddy who remembers what you’re learning!
          </h2>
          <p>
            Knowing new words and grammar is one thing. Using them naturally is
            another. Chat with Huahua about the topics you’re learning, practice
            using your new vocabulary and grammar, and get helpful feedback
            along the way.
          </p>
          <Link href={PLAN} className={styles.textLink}>
            Find your starting point <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Pronunciation() {
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const openPreview = (event: React.MouseEvent<HTMLButtonElement>) => {
    previewTrigger.current = event.currentTarget;
    setPreviewOpen(true);
  };
  return (
    <section
      className={`${styles.container} ${styles.pronunciation}`}
      id="pronunciation"
      aria-labelledby="speaking-title"
    >
      <div className={styles.speaking}>
        <h2 id="speaking-title">
          Practice speaking
          <br className={styles.desktopBreak} /> as you learn.
        </h2>
        <p>
          Listen to native pronunciation, record your own voice, and get
          feedback to help you speak with confidence.
        </p>
        <button
          type="button"
          onClick={openPreview}
          aria-haspopup="dialog"
          className={styles.microphonePanel}
          style={{ width: "100%", border: 0, cursor: "pointer" }}
          aria-label="Find your voice: explore Pronunciation Academy"
        >
          <span className={styles.waveform} aria-hidden="true">
            {Array.from({ length: 15 }, (_, i) => (
              <i
                key={i}
                style={{ height: `${8 + Math.sin(i * 1.6) ** 2 * 30}px` }}
              />
            ))}
          </span>
          <span className={styles.micCircle}>
            <Mic size={30} />
          </span>
          <span className={styles.waveform} aria-hidden="true">
            {Array.from({ length: 15 }, (_, i) => (
              <i
                key={i}
                style={{ height: `${8 + Math.sin(i * 1.4) ** 2 * 30}px` }}
              />
            ))}
          </span>
          <span className={styles.micCaption}>Find your voice</span>
        </button>
      </div>
      <div className={styles.academy}>
        <h2>Pronunciation Academy</h2>
        <span className={styles.levelTag}>For learners ready to refine</span>
        <h3>Know the words, but still get misunderstood?</h3>
        <p>
          Pronunciation habits can be hard to break. You might know exactly what
          you want to say, but the way you pronounce it doesn‘t always come
          across as intended. Pronunciation Academy helps you break old habits
          and build better ones through structured lessons, listening and
          speaking practice, and fun pronunciation challenges.
        </p>
        <div className={styles.tonesCard}>
          <h3>Four tones. A clearer foundation.</h3>
          <div className={styles.tones}>
            {[
              { word: "mā", path: "M8 18H47", color: "#b95144" },
              { word: "má", path: "M8 32L47 10", color: "#e69a21" },
              { word: "mǎ", path: "M8 17Q25 43 47 11", color: "#b07d2d" },
              { word: "mà", path: "M8 9L47 34", color: "#3c947a" },
            ].map((tone, index) => (
              <button
                key={tone.word}
                aria-label={`${tone.word} ${index + 1}: listen to tone ${index + 1}`}
                onClick={() =>
                  speak(["妈", "麻", "马", "骂"][index], () =>
                    setMessage("Audio isn’t available in this browser."),
                  )
                }
              >
                <svg viewBox="0 0 56 48" aria-hidden="true">
                  <path
                    d={tone.path}
                    stroke={tone.color}
                    strokeWidth="5"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <span>{tone.word}</span>
                <small>{index + 1}</small>
              </button>
            ))}
          </div>
        </div>
        <span className={styles.srOnly} role="status">
          {message}
        </span>
        <button
          type="button"
          className={styles.academyLink}
          aria-haspopup="dialog"
          onClick={openPreview}
          style={{ cursor: "pointer", background: "transparent" }}
        >
          Explore Pronunciation Academy
        </button>
      </div>
      {previewOpen && (
        <PronunciationPreview
          onClose={() => {
            setPreviewOpen(false);
            requestAnimationFrame(() => previewTrigger.current?.focus());
          }}
        />
      )}
    </section>
  );
}

export default function NewLandingPage() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) return;
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, [reduced]);
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <Navigation />
      <main id="main">
        <section
          className={`${styles.container} ${styles.hero}`}
          aria-labelledby="hero-title"
        >
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              Structured Mandarin learning, built around your life.
            </p>
            <h1 id="hero-title">
              Learn the Mandarin
              <br className={styles.desktopBreak} /> that matters to you.
            </h1>
            <p className={styles.heroLead}>
              For learners with real reasons to speak Mandarin.
            </p>
            <p className={styles.heroDescription}>
              Follow a structured learning path built around topics you care
              about. Learn practical vocabulary, practice with interactive
              exercises, have real conversations, and build your speaking
              confidence along the way.
            </p>
            <PlanLink>Build My First Plan — Free</PlanLink>
          </div>
          <HeroArt />
        </section>
        <LandingWaveTransition />
        <TopicSection />
        <section
          className={`${styles.container} ${styles.learning}`}
          id="how-it-works"
          aria-labelledby="learning-title"
        >
          <div className={styles.learningCopy} id="why">
            <h2 id="learning-title">
              More than memorizing random words from a textbook.
            </h2>
            <p>
              Learn grammar in context, discover useful vocabulary, read
              personalized stories, reinforce what you’ve learned with
              interactive exercises and quizzes, and put it all into practice
              through conversations.
            </p>
          </div>
          <LessonCards />
        </section>
        {/* Temporarily hidden — lesson preview video section
        <LessonPreview />
        */}
        <Huahua />
        <Pronunciation />
        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={`${styles.container} ${styles.closingInner}`}>
            <Image
              src={`${A}/09_closing_capy_palm_foreground.webp`}
              alt="A happy capybara holding an orange under a palm tree."
              width={1536}
              height={1024}
              sizes="(max-width: 760px) 76vw, 520px"
              className={styles.closingMascot}
            />
            <div className={styles.closingCopy}>
              <h2 id="closing-title">
                Your interests. Your goals.
                <br /> Your Mandarin journey.
              </h2>
              <p>
                Whatever your reason for learning Mandarin, turn it into a
                structured learning plan and take your next step with
                confidence.
              </p>
              <PlanLink />
            </div>
          </div>
          <Image
            src={`${A}/10_closing_shoreline_background.webp`}
            alt=""
            width={2172}
            height={724}
            sizes="100vw"
            className={styles.shoreline}
          />
        </section>
      </main>
      <footer className={`${styles.container} ${styles.footer}`}>
        <Link href="/" aria-label="LingoIsland home">
          <HomeWordmark height={45} />
        </Link>
        <nav aria-label="Footer navigation">
          <Link href="/team">Our Team</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
