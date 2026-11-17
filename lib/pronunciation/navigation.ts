export const PRONUNCIATION_PRACTICE_PATH = "/app/pronunciation/practice";

/** Journey sessions return to their map; standalone sessions return to practice. */
export function pronunciationSessionReturnPath(pathname: string, journeyId: string | null): string {
  if (!journeyId) return PRONUNCIATION_PRACTICE_PATH;
  const appBase = pathname.startsWith("/hsk/app") ? "/hsk/app" : "/app";
  return `${appBase}/journey/${encodeURIComponent(journeyId)}`;
}
