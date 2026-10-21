export function getLocalDateKey(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone() {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  } catch {
    return "UTC";
  }
}

/** Calendar day (YYYY-MM-DD) in an IANA time zone. Falls back to the runtime clock. */
export function dateKeyInTimeZone(
  timeZone: string | null | undefined,
  date: Date = new Date(),
) {
  if (!timeZone || !isValidTimeZone(timeZone)) {
    return getLocalDateKey(date);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return getLocalDateKey(date);
  return `${year}-${month}-${day}`;
}

