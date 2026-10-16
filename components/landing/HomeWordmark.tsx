import Image from "next/image";

/** Painted LingoIsland wordmark. The image already includes the name. */
export default function HomeWordmark({ height = 56 }: { height?: number }) {
  return (
    <Image
      src="/brand/wordmark.png"
      alt="LingoIsland"
      width={820}
      height={306}
      quality={90}
      style={{ height, width: "auto" }}
    />
  );
}
