import Image from "next/image";
import { Star } from "lucide-react";
import { HSK_TESTIMONIAL } from "@/lib/hskprep-content";

type TestimonialContent = {
  headline: string;
  quote: string;
  name: string;
  image: string;
};

export default function HSKTestimonialPlaceholder({
  testimonial = HSK_TESTIMONIAL,
}: {
  testimonial?: TestimonialContent;
}) {
  return (
    <section
      className="fade-section"
      style={{ background: "#fff", padding: "40px 24px 80px" }}
    >
      <div
        className="hsk-testimonial-card"
        style={{
          position: "relative",
          overflow: "hidden",
          maxWidth: 720,
          margin: "0 auto",
          textAlign: "center",
          borderRadius: 24,
          background: "#fff",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
          padding: "40px 32px",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/hskprep/testimonial-bg.png)",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.74) 50%, rgba(255,255,255,0.82) 100%)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--lingo-teal)",
              marginBottom: 16,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {testimonial.headline}
          </p>

          <div
            aria-label="5 out of 5 stars"
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 4,
              marginBottom: 20,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={18}
                fill="var(--lingo-teal)"
                stroke="var(--lingo-teal)"
                strokeWidth={1.5}
                aria-hidden
              />
            ))}
          </div>

          <blockquote
            style={{
              margin: "0 0 24px",
              fontSize: 16.5,
              lineHeight: 1.65,
              color: "var(--lingo-navy)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            “{testimonial.quote}”
          </blockquote>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                border: "2px solid #fff",
                boxShadow: "0 2px 8px rgba(33,118,174,0.15)",
              }}
            >
              <Image
                src={testimonial.image}
                alt={testimonial.name}
                width={44}
                height={44}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
                sizes="44px"
              />
            </div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--lingo-navy)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                margin: 0,
              }}
            >
              {testimonial.name}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
