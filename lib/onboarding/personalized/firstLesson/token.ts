import { createHmac, timingSafeEqual } from "node:crypto";
import { cleanChinese, type LessonDraft } from "./personalization";
const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");
export function lessonToken(draft: LessonDraft, secret: string, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ expires: now + 86400000, targets: [draft.first.hanzi, draft.second.hanzi].map(cleanChinese) })).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}
export function validLessonTarget(token: unknown, target: unknown, secret: string | undefined, now = Date.now()): boolean {
  if (!secret || typeof token !== "string" || token.length > 5000 || typeof target !== "string") return false;
  try {
    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra) return false;
    const expected = Buffer.from(sign(body, secret)); const provided = Buffer.from(signature);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return false;
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof data.expires === "number" && data.expires > now && Array.isArray(data.targets) && data.targets.includes(target);
  } catch { return false; }
}
