"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type GlossaryEntry = {
  anchorId: string;
  hanzi: string;
  english?: string | null;
};

type GlossaryContextValue = {
  entries: GlossaryEntry[];
  activeWordId: string | null;
  setEntries: (entries: GlossaryEntry[]) => void;
  setActiveWordId: (id: string | null) => void;
};

const GlossaryContext = createContext<GlossaryContextValue | null>(null);

export function GlossaryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      entries,
      activeWordId,
      setEntries,
      setActiveWordId,
    }),
    [entries, activeWordId]
  );

  return (
    <GlossaryContext.Provider value={value}>
      {children}
    </GlossaryContext.Provider>
  );
}

export function useGlossary() {
  const context = useContext(GlossaryContext);
  if (!context) {
    throw new Error("useGlossary must be used within GlossaryProvider");
  }
  return context;
}

