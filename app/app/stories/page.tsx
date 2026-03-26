import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateKey } from "@/lib/utils/date";
import DailyStoryCard from "@/components/stories/DailyStoryCard";
import StoriesList from "@/components/stories/StoriesList";
import type { StorySummary } from "@/components/stories/StoryCard";
import { OceanBackground } from "@/components/OceanBackground";
import { getEntitlements } from "@/lib/entitlements";

export default async function StoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const entitlements = await getEntitlements(user.id);
    if (!entitlements.isPro) {
      redirect("/app?upgrade=1&feature=Daily%20Stories");
    }
  }

  let dailyStory = null;
  if (user) {
    const today = getLocalDateKey();
    const { data } = await supabase
      .from("stories")
      .select("id, title, level, date, created_at, story_zh")
      .eq("user_id", user.id)
      .eq("kind", "daily")
      .eq("date", today)
      .eq("saved", true)
      .maybeSingle();
    dailyStory = data || null;
  }

  let stories: StorySummary[] = [];
  if (user) {
    const { data } = await supabase
      .from("stories")
      .select("id, title, level, kind, date, created_at, story_zh")
      .eq("user_id", user.id)
      .or("kind.eq.custom,and(kind.eq.daily,saved.eq.true)")
      .order("created_at", { ascending: false });
    stories = (data as StorySummary[]) || [];
  }

  return (
    <div className="relative min-h-screen p-4 md:p-8">
      <OceanBackground />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-6 md:mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Stories</h1>
          <Link
            href="/app/stories/new"
            className="rounded-lg border-2 border-gray-900 bg-white px-5 md:px-6 py-2.5 md:py-3 text-sm md:text-base font-bold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 shadow-[0_0_14px_3px_rgba(147,197,253,0.6)]"
          >
            Create new story
          </Link>
        </div>

        <div className="mb-8 md:mb-10">
          <DailyStoryCard variant="stories" story={dailyStory} />
        </div>

        <div className="mb-3 md:mb-4 flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">All stories</h2>
        </div>

        <StoriesList stories={stories} />
      </div>
    </div>
  );
}
