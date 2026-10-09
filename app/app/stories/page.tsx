import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateKey } from "@/lib/utils/date";
import DailyStoryCard from "@/components/stories/DailyStoryCard";
import StoriesList from "@/components/stories/StoriesList";
import type { StorySummary } from "@/components/stories/StoryCard";
import T from "@/components/app/T";
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
      .select("id, title, title_en, level, date, created_at, story_zh")
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
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
            <T k="Stories" />
          </p>
          <h1 className="lingo-display mt-1 max-w-xl text-[34px] font-bold leading-tight text-(--lingo-navy) sm:text-[40px]">
            <T k="Stories" />
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-(--lingo-text-muted)">
            <T k="Real stories. Real progress. A more confident you." />
          </p>
        </div>
        <Link
          href="/app/stories/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-(--lingo-navy) px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-(--lingo-navy-soft)"
        >
          <span aria-hidden>+</span>
          <T k="Create New Story" />
        </Link>
      </div>

      <div className="mb-8">
        <DailyStoryCard variant="stories" story={dailyStory} />
      </div>

      <section>
        <h2 className="lingo-display mb-3.5 text-xl font-bold text-(--lingo-navy)">
          <T k="All stories" />
        </h2>
        <StoriesList stories={stories} />
      </section>
    </div>
  );
}
