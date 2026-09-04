"use client";

import { useParams } from "next/navigation";
import HskFlashcardsAdd from "@/components/hsk/HskFlashcardsAdd";

export default function HskFlashcardsAddPage() {
  const params = useParams();
  const deckId = params.id as string;
  return <HskFlashcardsAdd deckId={deckId} />;
}
