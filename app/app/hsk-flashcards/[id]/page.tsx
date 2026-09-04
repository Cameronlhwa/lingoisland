"use client";

import { useParams } from "next/navigation";
import HskFlashcardsDeckDetail from "@/components/hsk/HskFlashcardsDeckDetail";

export default function HskFlashcardsDeckPage() {
  const params = useParams();
  const deckId = params.id as string;
  return <HskFlashcardsDeckDetail deckId={deckId} />;
}
