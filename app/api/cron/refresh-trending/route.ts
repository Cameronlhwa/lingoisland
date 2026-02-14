/**
 * Weekly cron endpoint to refresh trending topics
 * 
 * Called by cron job (e.g., Vercel Cron) every Monday at 00:00 UTC
 * Creates new weekly batch with shuffled rankings and fresh featured selection
 * 
 * Protected by CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get Monday of current week
function getCurrentMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Category quotas for featured selection (12 total)
const CATEGORY_QUOTAS: Record<string, number> = {
  "Everyday errands": 2,
  "Travel": 2,
  "Health": 1,
  "Food & going out": 1,
  "Social life": 1,
  "Work/School": 1,
  "Money & adulting": 1,
  "Entertainment & hobbies": 1,
  "Opinions & hot takes": 1,
  "Unexpected problems": 1,
};

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const headerSecret = request.headers.get("x-cron-secret");
    
    if (cronSecret && headerSecret !== cronSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const weekOf = getCurrentMonday();
    const weekOfStr = weekOf.toISOString().split("T")[0];

    console.log(`[CRON] Refreshing trending topics for week of: ${weekOfStr}`);

    // Check if batch already exists for this week
    const { data: existing, error: checkError } = await supabase
      .from("trending_topics")
      .select("id")
      .eq("week_of", weekOfStr)
      .limit(1);

    if (checkError) {
      console.error("[CRON] Error checking existing batch:", checkError);
      return NextResponse.json(
        { error: "Database error", details: checkError.message },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      console.log("[CRON] Batch already exists for this week. Skipping.");
      return NextResponse.json({
        success: true,
        message: "Batch already exists for this week",
        weekOf: weekOfStr,
      });
    }

    // Get the most recent week's topics as the source pool
    const { data: previousBatch, error: fetchError } = await supabase
      .from("trending_topics")
      .select("slug, title_en, title_zh, category, tags, level, starter_prompts")
      .order("week_of", { ascending: false })
      .limit(300); // Get more than needed to ensure we have the full pool

    if (fetchError) {
      console.error("[CRON] Error fetching previous batch:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch previous batch", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!previousBatch || previousBatch.length === 0) {
      console.error("[CRON] No previous batch found. Run seed script first.");
      return NextResponse.json(
        { error: "No topics found. Please run seed script first." },
        { status: 400 }
      );
    }

    // Deduplicate by slug (keep first occurrence)
    const uniqueTopics = Array.from(
      new Map(previousBatch.map(t => [t.slug, t])).values()
    );

    console.log(`[CRON] Found ${uniqueTopics.length} unique topics from previous batch`);

    // Shuffle topics
    const shuffled = [...uniqueTopics].sort(() => Math.random() - 0.5);

    // Select featured topics with category diversity
    const featuredTopics: typeof uniqueTopics = [];
    const categoryCount: Record<string, number> = {};

    for (const topic of shuffled) {
      const count = categoryCount[topic.category] || 0;
      const quota = CATEGORY_QUOTAS[topic.category] || 0;

      if (count < quota) {
        featuredTopics.push(topic);
        categoryCount[topic.category] = count + 1;
      }

      if (featuredTopics.length >= 12) break;
    }

    console.log(`[CRON] Selected ${featuredTopics.length} featured topics`);

    // Prepare insert data with new rankings
    const insertData = uniqueTopics.map((topic, index) => {
      const isFeatured = featuredTopics.some(ft => ft.slug === topic.slug);
      const rank = isFeatured
        ? featuredTopics.findIndex(ft => ft.slug === topic.slug) + 1
        : 13 + index;

      return {
        slug: topic.slug,
        title_en: topic.title_en,
        title_zh: topic.title_zh,
        category: topic.category,
        tags: topic.tags,
        level: topic.level,
        starter_prompts: topic.starter_prompts,
        week_of: weekOfStr,
        rank,
        is_featured: isFeatured,
      };
    });

    // Insert in batches
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < insertData.length; i += batchSize) {
      const batch = insertData.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("trending_topics")
        .insert(batch);

      if (insertError) {
        console.error(`[CRON] Error inserting batch ${i / batchSize + 1}:`, insertError);
        return NextResponse.json(
          { error: "Failed to insert batch", details: insertError.message },
          { status: 500 }
        );
      }

      insertedCount += batch.length;
      console.log(`[CRON] Inserted batch ${i / batchSize + 1} (${batch.length} topics)`);
    }

    console.log(`[CRON] ✅ Successfully created new batch for ${weekOfStr}`);
    console.log(`[CRON]    - ${insertedCount} total topics`);
    console.log(`[CRON]    - ${featuredTopics.length} featured topics`);

    return NextResponse.json({
      success: true,
      message: "Trending topics refreshed successfully",
      weekOf: weekOfStr,
      totalTopics: insertedCount,
      featuredTopics: featuredTopics.length,
      categoryBreakdown: categoryCount,
    });

  } catch (error) {
    console.error("[CRON] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing (still requires secret)
export async function GET(request: NextRequest) {
  return POST(request);
}
