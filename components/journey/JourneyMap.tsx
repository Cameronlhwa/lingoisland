"use client";

import { useMemo } from "react";
import { Check, Lock, Mic } from "lucide-react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { JourneyPathNode } from "@/components/journey/JourneyDashboard";
import {
  ART_PIXELS,
  OCEAN_HEIGHT,
  OCEAN_SRC,
  OCEAN_WIDTH,
  SOURCE_H,
  SOURCE_W,
  artworkSrc,
  assignArtwork,
  journeyConnectorPoint,
  journeyIslandPosition,
  journeyIslandWidth,
  journeyRoutePath,
  visibleArtSize,
  type ArtworkId,
} from "@/lib/journeyMapLayout";

const COMPLETED = "#29B77A";
const CURRENT = "#FF7043";
const LOCKED_BG = "#EFF4F7";
const LOCKED_ICON = "#63758A";

function isClickable(node: JourneyPathNode) {
  if (node.type === "island") return node.completed || node.current || !!node.paywalled;
  return node.completed || node.current;
}

function IslandArt({
  art,
  dimmed,
  glowing,
}: {
  art: ArtworkId;
  dimmed: boolean;
  glowing: boolean;
}) {
  const pixels = ART_PIXELS[art];
  const { width: srcW, height: srcH } = visibleArtSize(art);
  const filter = dimmed
    ? "saturate(0.72) brightness(1.03) drop-shadow(0 8px 10px rgba(15,47,67,0.16))"
    : glowing
      ? "drop-shadow(0 0 14px rgba(255,112,67,0.8)) drop-shadow(0 8px 14px rgba(255,112,67,0.28))"
      : "drop-shadow(0 8px 10px rgba(15,47,67,0.16))";

  return (
    <div className="relative w-full" style={{ aspectRatio: `${srcW} / ${srcH}`, filter }}>
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={artworkSrc(art)}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            width: `${(SOURCE_W / srcW) * 100}%`,
            height: `${(SOURCE_H / srcH) * 100}%`,
            left: `${(-pixels.l / srcW) * 100}%`,
            top: `${(-pixels.t / srcH) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

function IslandLabel({ node }: { node: JourneyPathNode }) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const title = convertText(node.name);
  const zh = node.type === "island" && node.nameZh ? convertText(node.nameZh) : null;
  const meta =
    node.type === "island" ? [zh, `${node.wordCount} ${t("words")}`].filter(Boolean).join(" · ") : null;

  return (
    <div
      className="rounded-xl border bg-white px-2 py-1 text-center shadow-[0_4px_12px_rgba(15,47,67,0.14)]"
      style={{ borderColor: node.current ? "rgba(255,112,67,0.7)" : "rgba(15,47,67,0.08)" }}
    >
      {node.type === "story" ? (
        <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-amber-700">
          {t("Story")}
        </span>
      ) : null}
      <span className="block truncate text-[12px] font-bold leading-tight text-[var(--lingo-navy)]">
        {title}
      </span>
      {meta ? (
        <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-[var(--lingo-text-muted)]">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

function NumberBadge({ slot, completed, current }: { slot: number; completed: boolean; current: boolean }) {
  const style = completed
    ? { background: COMPLETED, color: "#fff" }
    : current
      ? { background: CURRENT, color: "#fff" }
      : { background: LOCKED_BG, color: LOCKED_ICON };
  return (
    <span
      className="absolute left-0.5 top-0.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow-sm"
      style={style}
    >
      {slot}
    </span>
  );
}

export function JourneyMap({
  nodes,
  onActivate,
  hskLevelByIslandId,
}: {
  nodes: JourneyPathNode[];
  onActivate: (node: JourneyPathNode) => void;
  hskLevelByIslandId?: Record<string, number>;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const artwork = useMemo(() => assignArtwork(nodes), [nodes]);

  const placed = useMemo(() => {
    const illustrated: Array<{ node: JourneyPathNode; slot: number }> = [];
    const tones: Array<{ node: JourneyPathNode; prevSlot: number | null; nextSlot: number | null }> = [];
    let slot = 0;
    let prevSlot: number | null = null;
    let pending: Array<{ node: JourneyPathNode; prevSlot: number | null; nextSlot: number | null }> = [];

    for (const node of nodes) {
      if (node.type === "tone_practice") {
        pending.push({ node, prevSlot, nextSlot: null });
        continue;
      }
      slot += 1;
      for (const tone of pending) tone.nextSlot = slot;
      tones.push(...pending);
      pending = [];
      illustrated.push({ node, slot });
      prevSlot = slot;
    }
    tones.push(...pending);
    return { illustrated, tones, slotCount: slot };
  }, [nodes]);

  const route = journeyRoutePath(placed.slotCount);

  return (
    <div className="max-md:overflow-x-auto">
      <div
        className="journey-map relative w-full overflow-hidden max-md:min-w-[900px]"
        style={{ aspectRatio: `${OCEAN_WIDTH} / ${OCEAN_HEIGHT}`, background: "#2ec6ef" }}
      >
        <img
          src={OCEAN_SRC}
          alt=""
          draggable={false}
          className="journey-map-background pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />

        {route ? (
          <svg
            className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d={route}
              fill="none"
              stroke="white"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="1.5 8"
              vectorEffect="non-scaling-stroke"
              opacity={0.78}
            />
          </svg>
        ) : null}

        <div className="island-layer absolute inset-0 z-[2]">
          {placed.illustrated.map(({ node, slot }) => {
            const position = journeyIslandPosition(slot);
            const art = artwork.get(node.id);
            const clickable = isClickable(node);
            const lockedLook = !node.completed && !node.current;
            const hskLevel = node.islandId ? hskLevelByIslandId?.[node.islandId] : undefined;
            const status = node.completed ? t("Completed") : node.current ? t("Current") : t("Locked");
            const kind = node.type === "story" ? t("Story checkpoint") : t("Island");

            return (
              <button
                key={node.id}
                type="button"
                disabled={!clickable}
                aria-label={`${t("Step")} ${slot}. ${kind}: ${convertText(node.name)}. ${status}.`}
                onClick={() => {
                  if (clickable) onActivate(node);
                }}
                className="journey-island group absolute border-0 bg-transparent p-0 outline-none focus-visible:z-20 enabled:cursor-pointer disabled:cursor-default enabled:hover:z-20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: `${journeyIslandWidth(slot)}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: node.current ? 6 : 2,
                }}
              >
                <span className="relative block transition-transform duration-200 ease-out motion-reduce:transition-none motion-safe:group-hover:-translate-y-1 motion-safe:group-focus-visible:-translate-y-1">
                  <span className="island-image-wrapper relative block">
                    {art ? (
                      <IslandArt art={art} dimmed={lockedLook} glowing={node.current} />
                    ) : null}
                    <NumberBadge slot={slot} completed={node.completed} current={node.current} />
                    {hskLevel ? (
                      <span className="absolute left-0.5 top-6 z-10 rounded-full bg-blue-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm">
                        HSK {hskLevel}
                      </span>
                    ) : null}
                    {node.current ? (
                      <span
                        className="absolute right-0.5 top-0.5 z-10 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow"
                        style={{ background: CURRENT }}
                      >
                        {t("Current")}
                      </span>
                    ) : null}
                    {node.completed ? (
                      <span
                        className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-white shadow"
                        style={{ background: COMPLETED }}
                      >
                        <Check size={12} strokeWidth={3} aria-hidden />
                      </span>
                    ) : null}
                    {lockedLook ? (
                      <span
                        className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full shadow"
                        style={{ background: LOCKED_BG, color: LOCKED_ICON }}
                      >
                        <Lock size={11} aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className="island-label absolute left-1/2 top-[calc(100%+6px)] z-10 w-[118%] -translate-x-1/2">
                    <IslandLabel node={node} />
                  </span>
                </span>
              </button>
            );
          })}

          {placed.tones.map(({ node, prevSlot, nextSlot }) => {
            const position = journeyConnectorPoint(
              prevSlot,
              nextSlot,
              placed.illustrated.map((item) => item.slot),
            );
            if (!position) return null;
            const clickable = isClickable(node);
            const status = node.completed ? t("Completed") : node.current ? t("Current") : t("Locked");
            return (
              <button
                key={node.id}
                type="button"
                disabled={!clickable}
                aria-label={`${t("Pronunciation checkpoint")}: ${convertText(node.name)}. ${status}.`}
                onClick={() => {
                  if (clickable) onActivate(node);
                }}
                className="absolute border-0 bg-transparent p-0 outline-none enabled:cursor-pointer disabled:cursor-default focus-visible:ring-2 focus-visible:ring-white"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: "3.6%",
                  transform: "translate(-50%, -50%)",
                  zIndex: node.current ? 5 : 3,
                }}
              >
                <span
                  className="flex aspect-square items-center justify-center rounded-full border border-white"
                  style={{
                    background: node.completed ? "#e9f8f1" : node.current ? "#fff1ec" : LOCKED_BG,
                    boxShadow: node.current
                      ? "0 0 0 3px rgba(255,112,67,0.45), 0 6px 14px rgba(255,112,67,0.2)"
                      : "0 4px 10px rgba(15,47,67,0.14)",
                  }}
                >
                  <Mic
                    className="h-[42%] w-[42%]"
                    color={node.current ? CURRENT : node.completed ? COMPLETED : LOCKED_ICON}
                    aria-hidden
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
