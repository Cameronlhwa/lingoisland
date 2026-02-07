"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { LANDING_EXAMPLE_ISLANDS } from "@/data/landingExampleIslands";
import SpeechBubble from "./SpeechBubble";
import BoatRoute from "./BoatRoute";

export default function ExampleIslandsMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const islandRefs = [
    useRef<HTMLAnchorElement>(null),
    useRef<HTMLAnchorElement>(null),
    useRef<HTMLAnchorElement>(null),
  ];

  const getIslandRef = useCallback(
    (index: number) => islandRefs[index] ?? { current: null },
    []
  );

  return (
    <section
      ref={containerRef}
      className="relative overflow-visible px-4 py-4 md:px-8 md:py-6"
    >
      {/* Boat layer must be direct child of section so path coordinates match */}
      <BoatRoute
        containerRef={containerRef}
        islandRefs={islandRefs as React.RefObject<HTMLAnchorElement | null>[]}
      />

      <div className="relative z-10 mx-auto max-w-6xl overflow-visible">
        {/* Map layout: 3 islands diagonally — hospital upper-left, ai center, cafe lower-right */}
        <div className="relative grid grid-cols-1 justify-items-center gap-x-12 gap-y-8 overflow-visible md:grid-cols-3 md:gap-x-16 md:gap-y-10">
          {LANDING_EXAMPLE_ISLANDS.map((island, index) => {
            const ref = getIslandRef(index);
            const positions = [
              "md:justify-self-end md:translate-x-4 md:-translate-y-2", // hospital: upper-left-ish
              "md:justify-self-center", // ai: center
              "md:justify-self-start md:-translate-x-4 md:-translate-y-2", // cafe: higher, right-ish
            ];
            return (
              <Link
                key={island.id}
                ref={ref as React.RefObject<HTMLAnchorElement>}
                href={`/onboarding/topic-island?example=${island.id}`}
                className={`group relative flex flex-col items-center ${positions[index]}`}
              >
                <div className="mb-0 transition-shadow duration-200">
                  <SpeechBubble label={island.title} />
                </div>
                <div className="relative h-56 w-80 transition-transform duration-250 ease-out will-change-transform group-hover:scale-[1.03] md:h-72 md:w-[28rem]">
                  <Image
                    src={island.image}
                    alt={island.title}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 320px, 448px"
                    priority={index < 2}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
