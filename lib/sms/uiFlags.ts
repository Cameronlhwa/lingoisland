/**
 * Temporary: hide Texting with 华华 everywhere until it is ready.
 * Set NEXT_PUBLIC_HUAHUA_TEXTING_UI=1 to show it (local, preview, or production).
 */
export function isHuahuaTextingUiEnabled() {
  return process.env.NEXT_PUBLIC_HUAHUA_TEXTING_UI === "1";
}
