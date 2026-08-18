"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type TTSSettings = {
  ttsRateSentences: number;
  ttsRateWords: number;
};

type TTSContextType = {
  settings: TTSSettings;
  updateSettings: (settings: Partial<TTSSettings>) => Promise<void>;
  isLoading: boolean;
};

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export function TTSProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<TTSSettings>({
    ttsRateSentences: 1.0,
    ttsRateWords: 1.0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          setSettings({
            ttsRateSentences: data.ttsRateSentences || 1.0,
            ttsRateWords: data.ttsRateWords || 1.0,
          });
        }
      } catch (error) {
        console.error("Error loading TTS settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<TTSSettings>) => {
    const previous = settings;
    setSettings((current) => ({
      ttsRateSentences:
        newSettings.ttsRateSentences ?? current.ttsRateSentences,
      ttsRateWords: newSettings.ttsRateWords ?? current.ttsRateWords,
    }));

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error("Failed to update TTS settings");
      }

      const data = await response.json();
      setSettings({
        ttsRateSentences: data.ttsRateSentences || previous.ttsRateSentences,
        ttsRateWords: data.ttsRateWords || previous.ttsRateWords,
      });
    } catch (error) {
      setSettings(previous);
      console.error("Error updating TTS settings:", error);
      throw error;
    }
  };

  return (
    <TTSContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error("useTTS must be used within a TTSProvider");
  }
  return context;
}
