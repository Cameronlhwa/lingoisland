import { Flag } from "lucide-react";
import type { ChatTurn } from "@/lib/onboarding/personalized/firstLesson/types";
import { GREEN } from "../ui";

export function ChatSituation({ mission, fallback }: { mission?: ChatTurn["mission"]; fallback: string }) {
 return <section aria-labelledby="chat-situation-heading" data-testid="lesson-chat-situation" className="mb-4 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: GREEN, color: "white" }}>
  <span className="flex shrink-0 items-center self-stretch border-r border-white/25 pr-3" aria-hidden><Flag size={24}/></span>
  <div className="min-w-0">
   <h2 id="chat-situation-heading" className="sr-only" style={{ color: "white" }}>Your situation</h2>
   <p className="text-sm leading-relaxed" data-testid="chat-situation-context">{mission?.context ?? fallback}</p>
   <p className="mt-1 text-base font-bold leading-snug sm:text-lg" data-testid="chat-situation-goal">{mission?.task ?? "Choose the Mandarin reply that fits this situation."}</p>
  </div>
 </section>;
}
