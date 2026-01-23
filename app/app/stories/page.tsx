import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DailyStoryCard from "@/components/stories/DailyStoryCard";
import StoriesList from "@/components/stories/StoriesList";
import type { StorySummary } from "@/components/stories/StoryCard";

export default async function StoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dailyStory = null;
  if (user) {
    const today = new Date().toISOString().slice(0, 10);
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
    <div className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Stories</h1>
          <Link
            href="/app/stories/new"
            className="rounded-lg border border-gray-900 bg-white px-6 py-3 text-base font-medium uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50"
          >
            Create new story
          </Link>
        </div>

        <div className="mb-10">
          <DailyStoryCard variant="stories" story={dailyStory} />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">All stories</h2>
        </div>

        <StoriesList stories={stories} />
      </div>
    </div>
  );
}

