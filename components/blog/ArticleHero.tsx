"use client";

type ArticleHeroProps = {
  src: string;
  alt: string;
};

export function ArticleHero({ src, alt }: ArticleHeroProps) {
  return (
    <div
      className="mb-8 aspect-[2/1] w-full max-w-[800px] overflow-hidden rounded-xl"
      style={{ background: "#D6EEF8" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={800}
        height={400}
        className="h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}
