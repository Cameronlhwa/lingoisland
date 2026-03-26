import { redirect } from "next/navigation";

export default async function JourneyStoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; storyId: string }>;
  searchParams?: Promise<{ journeyNodeId?: string }>;
}) {
  const { id, storyId } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const journeyNodeId = resolvedSearch?.journeyNodeId;
  const query = new URLSearchParams({ journeyId: id });
  if (journeyNodeId) {
    query.set("journeyNodeId", journeyNodeId);
  }
  redirect(`/app/story/${storyId}?${query.toString()}`);
}
