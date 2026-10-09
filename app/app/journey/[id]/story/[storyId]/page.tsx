import { redirect } from "next/navigation";

export default async function JourneyStoryPage(
  props: {
    params: Promise<{ id: string; storyId: string }>;
    searchParams?: Promise<{ journeyNodeId?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const { id, storyId } = await props.params;
  const journeyNodeId = searchParams?.journeyNodeId;
  const query = new URLSearchParams({ journeyId: id });
  if (journeyNodeId) {
    query.set("journeyNodeId", journeyNodeId);
  }
  redirect(`/app/story/${storyId}?${query.toString()}`);
}
