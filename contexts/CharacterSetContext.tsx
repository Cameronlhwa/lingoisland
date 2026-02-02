"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { convertText } from "@/lib/utils/chinese-converter";

type CharacterSet = "simplified" | "traditional";

interface CharacterSetContextType {
  characterSet: CharacterSet;
  setCharacterSet: (characterSet: CharacterSet) => void;
  convertText: (text: string) => string;
  loading: boolean;
}

const CharacterSetContext = createContext<CharacterSetContextType | undefined>(
  undefined
);

export function CharacterSetProvider({ children }: { children: ReactNode }) {
  const [characterSet, setCharacterSetState] = useState<CharacterSet>("simplified");
  const [loading, setLoading] = useState(true);

  // Load character set preference from user profile on mount
  useEffect(() => {
    const loadCharacterSet = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          if (data.characterSet) {
            setCharacterSetState(data.characterSet);
          }
        }
      } catch (error) {
        console.error("Error loading character set preference:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCharacterSet();
  }, []);

  // Update character set preference both locally and on server
  const setCharacterSet = useCallback(async (newCharacterSet: CharacterSet) => {
    setCharacterSetState(newCharacterSet);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterSet: newCharacterSet }),
      });

      if (!response.ok) {
        console.error("Failed to save character set preference");
        // Optionally revert on error, but we keep the optimistic update for better UX
      }
    } catch (error) {
      console.error("Error saving character set preference:", error);
    }
  }, []);

  // Convert text based on current character set
  const convertTextCallback = useCallback(
    (text: string) => {
      return convertText(text, characterSet);
    },
    [characterSet]
  );

  return (
    <CharacterSetContext.Provider
      value={{
        characterSet,
        setCharacterSet,
        convertText: convertTextCallback,
        loading,
      }}
    >
      {children}
    </CharacterSetContext.Provider>
  );
}

export function useCharacterSet() {
  const context = useContext(CharacterSetContext);
  if (context === undefined) {
    // Fallback for components not wrapped in provider
    return {
      characterSet: "simplified" as CharacterSet,
      setCharacterSet: () => {},
      convertText: (text: string) => text,
      loading: false,
    };
  }
  return context;
}
