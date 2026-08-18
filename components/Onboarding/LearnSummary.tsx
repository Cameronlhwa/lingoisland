"use client";

interface Word {
  hanzi: string;
  pinyin: string;
  english: string;
}

interface LearnSummaryProps {
  words: Word[];
  islandLevel: string;
  topic: string;
  onContinue: () => void;
}

export default function LearnSummary({
  words,
  islandLevel,
  onContinue,
}: LearnSummaryProps) {
  const isA0 = islandLevel === "A0";
  const isBeginnerLevel = ["A0", "A1", "A2"].includes(islandLevel);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#D6EEF8",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          border: "0.5px solid #C2DCF0",
          padding: "40px 36px",
          width: "100%",
          maxWidth: "480px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🦫</div>

        {isA0 ? (
          <>
            <div
              style={{
                fontSize: 28,
                fontFamily: "'Lora', Georgia, serif",
                color: "#071E2E",
                marginBottom: 6,
              }}
            >
              你好。
            </div>
            <div
              style={{
                fontSize: 15,
                color: "#5A7A90",
                marginBottom: 24,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              That&apos;s &quot;hello&quot; in Mandarin. And you just said it.
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#071E2E",
              marginBottom: 24,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {isBeginnerLevel
              ? "You just learned:"
              : "3 new words added to your Mandarin:"}
          </div>
        )}

        <div
          style={{ borderTop: "0.5px solid #E8F3FA", marginBottom: 24 }}
        />

        <div style={{ marginBottom: 24 }}>
          {(isA0 ? words.slice(0, 5) : words.slice(0, 3)).map((word, i) => {
            const lastIndex = isA0
              ? Math.min(words.length, 5) - 1
              : Math.min(words.length, 3) - 1;
            return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
                padding: "10px 0",
                borderBottom: i < lastIndex ? "0.5px solid #F0F8FF" : "none",
                alignItems: "center",
              }}
            >
              {isA0 ? (
                <>
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 20,
                      fontWeight: 600,
                      color: "#2176AE",
                      textAlign: "left",
                    }}
                  >
                    {word.pinyin}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Lora', Georgia, serif",
                      fontSize: 18,
                      color: "#071E2E",
                      textAlign: "center",
                    }}
                  >
                    {word.hanzi}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#8AABBF",
                      textAlign: "right",
                    }}
                  >
                    {word.english}
                  </span>
                </>
              ) : (
                <>
                  <span
                    style={{
                      fontFamily: "'Lora', Georgia, serif",
                      fontSize: 20,
                      color: "#071E2E",
                      textAlign: "left",
                    }}
                  >
                    {word.hanzi}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#5A7A90",
                      textAlign: "center",
                    }}
                  >
                    {word.pinyin}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "#8AABBF",
                      textAlign: "right",
                    }}
                  >
                    {word.english}
                  </span>
                </>
              )}
            </div>
            );
          })}
        </div>

        <div
          style={{ borderTop: "0.5px solid #E8F3FA", marginBottom: 20 }}
        />

        <div
          style={{
            fontSize: 14,
            color: "#5A7A90",
            marginBottom: 28,
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.6,
          }}
        >
          {isA0
            ? "5 words. Your first Mandarin words — for real."
            : isBeginnerLevel
              ? "3 words. And you already know how to use them in a real sentence."
              : "You just used them in a real conversation. That's how LingoIsland works."}
        </div>

        <button
          type="button"
          onClick={onContinue}
          style={{
            background: "#2176AE",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "14px 40px",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          See what&apos;s next →
        </button>
      </div>
    </div>
  );
}
