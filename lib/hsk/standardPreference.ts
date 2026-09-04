import type { HskStandard } from "@/lib/utils/hsk";
import { parseHskStandard } from "@/lib/utils/hsk";

export const HSK_STANDARD_COOKIE = "lingo_hsk_standard";

export function parseHskStandardCookie(
  value: string | undefined | null,
): HskStandard | null {
  if (value === "2.0" || value === "3.0") return value;
  return null;
}

export function resolveHskStandard(options: {
  query?: string | null;
  profile?: string | null;
  cookie?: string | null;
}): HskStandard {
  return parseHskStandard(
    parseHskStandardCookie(options.query) ??
      parseHskStandardCookie(options.profile) ??
      parseHskStandardCookie(options.cookie),
  );
}
