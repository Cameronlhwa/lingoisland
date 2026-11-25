import { LessonError } from "./errors";
const requests = new Map<string, { until: number; count: number }>();
export function limitLessonRequests(userId: string, action: string, limit = 30, now = Date.now()) {
  for (const [key, entry] of Array.from(requests)) if (entry.until <= now) requests.delete(key);
  const key = `${userId}:${action}`, entry = requests.get(key) ?? { until: now + 60_000, count: 0 };
  if (++entry.count > limit) throw new LessonError("Please wait a moment before trying again", 429);
  requests.set(key, entry);
  if (requests.size > 5000) requests.delete(requests.keys().next().value!);
}
