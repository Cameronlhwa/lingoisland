/**
 * Cookie that lets users switch between the core "Islands" experience
 * and HSK Prep without permanently flipping product_track.
 */
export const APP_SIDE_COOKIE = "lingo_side";
export type AppSide = "islands" | "hsk";

export function parseAppSide(value: string | undefined | null): AppSide | null {
  if (value === "islands" || value === "hsk") return value;
  return null;
}

export function resolveProductTrack(
  profileTrack: string | null | undefined,
  sideOverride: AppSide | null,
): "core" | "hsk" {
  if (sideOverride === "islands") return "core";
  if (sideOverride === "hsk") return "hsk";
  return profileTrack === "hsk" ? "hsk" : "core";
}

export function setAppSideCookie(side: AppSide) {
  if (typeof document === "undefined") return;
  document.cookie = `${APP_SIDE_COOKIE}=${side}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/** Client-side: true when the user is viewing the Islands experience (not HSK prep). */
export function isIslandsExperienceActive(pathname: string): boolean {
  if (pathname.startsWith("/hsk/app")) return false;
  if (!pathname.startsWith("/app")) return false;
  const side = getAppSideFromCookie();
  return side !== "hsk";
}

export function getAppSideFromCookie(): AppSide | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`${APP_SIDE_COOKIE}=([^;]+)`),
  );
  return parseAppSide(match?.[1]);
}

/** Post-login destination for marketing nav "Sign in" links. */
export function postLoginPathForLanding(
  pathname: string | null | undefined,
): string {
  if (pathname?.startsWith("/hskprep")) return "/hsk/app";
  return "/app";
}

export function loginHrefForLanding(pathname: string | null | undefined): string {
  return `/login?next=${encodeURIComponent(postLoginPathForLanding(pathname))}`;
}
