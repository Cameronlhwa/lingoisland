"use client";

type IslandScreenshotProps = {
  src: string;
  topic: string;
};

export function IslandScreenshot({ src, topic }: IslandScreenshotProps) {
  return (
    <div
      className="my-4 overflow-hidden rounded-lg border bg-[#D6EEF8]"
      style={{ borderColor: "rgba(33, 118, 174, 0.2)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`LingoIsland ${topic} island example`}
        className="w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <p
        className="py-2 text-center text-xs"
        style={{ color: "#2176AE", fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        A {topic} island on LingoIsland
      </p>
    </div>
  );
}
