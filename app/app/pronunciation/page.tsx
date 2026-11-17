import { redirect } from "next/navigation";

/** Keep existing Pronunciation bookmarks working; the sidebar owns the submenu. */
export default function PronunciationPage() {
  redirect("/app/pronunciation/practice");
}
