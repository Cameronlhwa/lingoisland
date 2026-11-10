/**
 * Temporary: hide Texting with 华华 from the live site until it is ready.
 * Local and preview builds still show it. Set NEXT_PUBLIC_HUAHUA_TEXTING_UI=1
 * to force it on in production, or =0 to force it off everywhere.
 */
export function isHuahuaTextingUiEnabled() {
  const override = process.env.NEXT_PUBLIC_HUAHUA_TEXTING_UI;
  if (override === "1") return true;
  if (override === "0") return false;
  return process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";
}
