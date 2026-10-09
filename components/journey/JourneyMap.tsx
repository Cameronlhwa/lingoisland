"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Mic } from "lucide-react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { JourneyPathNode } from "@/components/journey/JourneyDashboard";
import {
  ART_PIXELS,
  DESKTOP_MAP_MIN_WIDTH,
  LABEL_GAP,
  LABEL_HANG,
  OCEAN_HEIGHT,
  OCEAN_HORIZON_COLOR,
  OCEAN_SHALLOW_COLOR,
  OCEAN_SRC,
  OCEAN_WIDTH,
  SOURCE_H,
  SOURCE_W,
  artworkSrc,
  layoutJourneyMap,
  visibleArtSize,
  type ArtworkId,
  type PlacedJourneyNode,
} from "@/lib/journeyMapLayout";

const MOUNTAIN_CROP = 0.5;

function isClickable(node: JourneyPathNode) {
  if (node.type === "island") return node.completed || node.current || !!node.paywalled;
  return node.completed || node.current;
}

function IslandArtwork({
  art,
  width,
  dimmed,
  glowing,
  lift,
}: {
  art: ArtworkId;
  width: number;
  dimmed: boolean;
  glowing: boolean;
  lift: boolean;
}) {
  const pixels = ART_PIXELS[art];
  const { height } = visibleArtSize(art, width);
  const scale = width / (pixels.r - pixels.l);
  const filter = dimmed
    ? "saturate(0.68) brightness(1.04) drop-shadow(0 8px 10px rgba(15,47,67,0.16))"
    : glowing
      ? "drop-shadow(0 0 12px rgba(251,146,60,0.85)) drop-shadow(0 8px 12px rgba(234,88,12,0.22))"
      : "drop-shadow(0 8px 10px rgba(15,47,67,0.16))";
  const hoverFilter = dimmed
    ? "saturate(0.68) brightness(1.04) drop-shadow(0 14px 18px rgba(15,47,67,0.24))"
    : glowing
      ? "drop-shadow(0 0 16px rgba(251,146,60,0.95)) drop-shadow(0 14px 18px rgba(234,88,12,0.28))"
      : "drop-shadow(0 14px 18px rgba(15,47,67,0.28))";

  return (
    <span
      className={`relative block transition-[filter] duration-200 ease-out motion-reduce:transition-none ${
        lift
          ? "motion-safe:group-hover:filter-(--island-hover-filter) motion-safe:group-focus-visible:filter-(--island-hover-filter)"
          : ""
      }`}
      style={{ width, height, filter, ["--island-hover-filter" as string]: hoverFilter }}
    >
      <span className="absolute inset-0 overflow-hidden">
        <img
          src={artworkSrc(art)}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            width: SOURCE_W * scale,
            height: SOURCE_H * scale,
            left: -pixels.l * scale,
            top: -pixels.t * scale,
          }}
        />
      </span>
    </span>
  );
}

function Nameplate({
  placement,
  scale,
  node,
}: {
  placement: PlacedJourneyNode;
  scale: number;
  node: JourneyPathNode;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const shift = placement.labelShiftX * scale;
  const width = placement.labelWidth * scale;
  const title = convertText(node.name);
  const zh = node.type === "island" && node.nameZh ? convertText(node.nameZh) : null;
  const meta =
    node.type === "island"
      ? [zh, `${node.wordCount} ${t("words")}`].filter(Boolean).join(" · ")
      : null;
  const tone = node.type === "tone_practice";

  const position =
    placement.labelSide === "overlay"
      ? { left: "50%", bottom: -LABEL_HANG * scale, transform: `translateX(calc(-50% + ${shift}px))` }
      : placement.labelSide === "above"
        ? { left: "50%", bottom: `calc(100% + ${LABEL_GAP * scale}px)`, transform: `translateX(calc(-50% + ${shift}px))` }
        : placement.labelSide === "left" || placement.labelSide === "right"
          ? { left: "50%", top: "50%", transform: `translate(calc(-50% + ${shift}px), -50%)` }
          : { left: "50%", top: `calc(100% + ${LABEL_GAP * scale}px)`, transform: `translateX(calc(-50% + ${shift}px))` };

  const border = node.current ? "rgba(234,88,12,0.35)" : "rgba(15,47,67,0.08)";

  return (
    <span
      className={`absolute rounded-xl border bg-white text-center shadow-[0_4px_12px_rgba(15,47,67,0.12)] ${
        tone ? "px-1.5 py-0.5" : "px-2 py-1.5"
      }`}
      style={{ ...position, width, borderColor: border }}
    >
      {node.type === "story" ? (
        <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-amber-700">
          {t("Story")}
        </span>
      ) : null}
      <span
        className={`block font-bold leading-[1.15] text-(--lingo-navy) ${
          tone ? "truncate text-[10px]" : "line-clamp-2 text-[12px]"
        }`}
      >
        {title}
      </span>
      {meta ? (
        <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-(--lingo-text-muted)">
          {meta}
        </span>
      ) : null}
    </span>
  );
}

function StepBadge({ step, completed, current }: { step: number; completed: boolean; current: boolean }) {
  const tone = completed
    ? "bg-(--lingo-teal) text-white"
    : current
      ? "bg-orange-500 text-white"
      : "border border-[rgba(15,47,67,0.14)] bg-white text-(--lingo-navy)";
  return (
    <span
      className={`absolute left-0.5 top-0.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow-xs ${tone}`}
    >
      {step}
    </span>
  );
}

function MapNodeButton({
  node,
  placement,
  scale,
  hskLevel,
  onActivate,
}: {
  node: JourneyPathNode;
  placement: PlacedJourneyNode;
  scale: number;
  hskLevel?: number;
  onActivate: (node: JourneyPathNode) => void;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const clickable = isClickable(node);
  const status = node.completed ? t("Completed") : node.current ? t("Current") : t("Locked");
  const kind =
    node.type === "story"
      ? t("Story checkpoint")
      : node.type === "tone_practice"
        ? t("Pronunciation checkpoint")
        : t("Island");
  const width = placement.width * scale;
  const lockedLook = !node.completed && !node.current;
  const illustrated = Boolean(placement.artwork);

  return (
    <button
      type="button"
      disabled={!clickable}
      aria-label={`${t("Step")} ${placement.step}. ${kind}: ${convertText(node.name)}. ${status}.`}
      onClick={() => {
        if (clickable) onActivate(node);
      }}
      className="group absolute rounded-2xl outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-(--lingo-navy) enabled:cursor-pointer disabled:cursor-default enabled:hover:z-24! focus-visible:z-24!"
      style={{
        left: placement.anchorX * scale,
        top: placement.anchorY * scale,
        width,
        transform: "translate(-50%, -100%)",
        zIndex: Math.min(placement.step, 20),
        touchAction: "manipulation",
      }}
    >
      <span
        className={`relative block origin-bottom transition-transform duration-200 ease-out motion-reduce:transition-none ${
          clickable
            ? "motion-safe:group-hover:transform-[translateY(-4px)_scale(1.03)] motion-safe:group-focus-visible:transform-[translateY(-4px)_scale(1.03)]"
            : ""
        }`}
      >
        {placement.artwork ? (
          <IslandArtwork
            art={placement.artwork}
            width={width}
            dimmed={lockedLook}
            glowing={node.current}
            lift={clickable}
          />
        ) : (
          <span
            className="flex items-center justify-center rounded-full border border-white transition-shadow duration-200 ease-out motion-reduce:transition-none"
            style={{
              width,
              height: placement.height * scale,
              background: node.completed ? "#f0fdfa" : node.current ? "#fff7ed" : "#f4fcff",
              boxShadow: node.current
                ? "0 0 0 3px rgba(251,146,60,0.45), 0 6px 14px rgba(234,88,12,0.18)"
                : "0 4px 10px rgba(15,47,67,0.14)",
            }}
          >
            <Mic
              size={Math.round(width * 0.42)}
              color={node.current ? "#ea580c" : node.completed ? "#0f766e" : "#7aa0b5"}
              aria-hidden
            />
          </span>
        )}

        <StepBadge step={placement.step} completed={node.completed} current={node.current} />
        {hskLevel && illustrated ? (
          <span className="absolute left-0.5 top-6 z-10 rounded-full bg-blue-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-xs">
            HSK {hskLevel}
          </span>
        ) : null}
        {illustrated && node.current ? (
          <span className="absolute right-0.5 top-0.5 z-10 rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
            {t("Current")}
          </span>
        ) : null}
        {!illustrated && node.current ? (
          <span className="absolute right-0 top-0 z-10 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />
        ) : null}
        {node.completed ? (
          <span
            className={`absolute z-10 flex items-center justify-center rounded-full bg-(--lingo-teal) text-white shadow ${
              illustrated ? "right-0.5 top-0.5 h-5 w-5" : "right-0 top-0 h-3.5 w-3.5"
            }`}
          >
            <Check size={illustrated ? 12 : 9} strokeWidth={3} aria-hidden />
          </span>
        ) : null}
        {lockedLook ? (
          <span
            className={`absolute z-10 flex items-center justify-center rounded-full bg-white/95 text-(--lingo-navy) shadow ${
              illustrated ? "right-0.5 top-0.5 h-5 w-5" : "right-0 top-0 h-3.5 w-3.5"
            }`}
          >
            <Lock size={illustrated ? 11 : 8} aria-hidden />
          </span>
        ) : null}

        <Nameplate placement={placement} scale={scale} node={node} />
      </span>
    </button>
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
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const mode = width >= DESKTOP_MAP_MIN_WIDTH ? "desktop" : "mobile";
  const layout = useMemo(
    () => (width > 0 ? layoutJourneyMap(nodes, { mode, width }) : null),
    [nodes, mode, width],
  );
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const scale = layout ? width / layout.stageWidth : 1;

  return (
    <div ref={frameRef} className="relative isolate z-0 w-full">
      {layout ? (
        mode === "desktop" ? (
          <div
            className="relative w-full"
            style={{ height: layout.stageHeight * scale, background: OCEAN_SHALLOW_COLOR }}
          >
            <img
              src={OCEAN_SRC}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 w-full select-none"
              style={{ height: layout.imageHeight * scale, objectFit: "cover" }}
            />
            {layout.stageHeight > layout.imageHeight ? (
              <div
                className="pointer-events-none absolute inset-x-0"
                style={{
                  top: (layout.imageHeight - 64) * scale,
                  height: 72 * scale,
                  background: `linear-gradient(to bottom, transparent, ${OCEAN_SHALLOW_COLOR})`,
                }}
              />
            ) : null}
            {layout.placements.map((placement) => {
              const node = byId.get(placement.id);
              if (!node) return null;
              return (
                <MapNodeButton
                  key={placement.id}
                  node={node}
                  placement={placement}
                  scale={scale}
                  hskLevel={node.islandId ? hskLevelByIslandId?.[node.islandId] : undefined}
                  onActivate={onActivate}
                />
              );
            })}
          </div>
        ) : (
          <div style={{ background: `linear-gradient(180deg, ${OCEAN_HORIZON_COLOR} 0%, #b7eef8 28%, ${OCEAN_SHALLOW_COLOR} 100%)` }}>
            <div
              className="relative w-full overflow-hidden"
              style={{ aspectRatio: `${OCEAN_WIDTH} / ${Math.round(OCEAN_HEIGHT * MOUNTAIN_CROP)}` }}
            >
              <img
                src={OCEAN_SRC}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-0 top-0 h-auto w-full max-w-none select-none"
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
                style={{ background: `linear-gradient(to bottom, transparent, ${OCEAN_HORIZON_COLOR})` }}
              />
            </div>
            <div className="relative w-full" style={{ height: layout.stageHeight }}>
              {layout.placements.map((placement) => {
                const node = byId.get(placement.id);
                if (!node) return null;
                return (
                  <MapNodeButton
                    key={placement.id}
                    node={node}
                  placement={placement}
                  scale={scale}
                  hskLevel={node.islandId ? hskLevelByIslandId?.[node.islandId] : undefined}
                    onActivate={onActivate}
                  />
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="w-full" style={{ aspectRatio: `${OCEAN_WIDTH} / ${OCEAN_HEIGHT}`, background: OCEAN_SHALLOW_COLOR }} />
      )}
    </div>
  );
}
