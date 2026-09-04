"use client";

import { useParams } from "next/navigation";
import HskFlashcardsSession from "@/components/hsk/HskFlashcardsSession";

export default function HskFlashcardsSessionPage() {
  const params = useParams();
  const deckId = params.id as string;
  return <HskFlashcardsSession deckId={deckId} />;
}
