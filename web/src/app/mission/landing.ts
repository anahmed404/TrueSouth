/** The landing-date picker's date and hour boxes, in UTC. Display only. */

/** "2028-03-01T05:00:00Z" → { date: "2028-03-01", hour: 5 }. */
export function splitUtc(utc: string): { date: string; hour: number } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?Z$/.exec(utc);
  if (!match) return null;
  return { date: match[1] ?? "", hour: Number(match[2]) };
}

/** { "2028-03-01", 5 } → "2028-03-01T05:00:00Z", or null when the date is not real. */
export function joinUtc(date: string, hour: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const utc = `${date}T${String(hour).padStart(2, "0")}:00:00Z`;
  const ms = Date.parse(utc);
  if (Number.isNaN(ms)) return null;
  // Date.parse rolls 2028-02-30 over to March; refuse it instead.
  return new Date(ms).toISOString().slice(0, 10) === date ? utc : null;
}

/** The UTC day of a timestamp, for a date box's min and max. */
export function utcDay(utc: string): string {
  return splitUtc(utc)?.date ?? "";
}
