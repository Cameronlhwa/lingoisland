"use client";

import { useParams } from "next/navigation";
import HskFlashcardsManage from "@/components/hsk/HskFlashcardsManage";

export default function HskFlashcardsManagePage() {
  const params = useParams();
  const deckId = params.id as string;
  return <HskFlashcardsManage deckId={deckId} />;
}
