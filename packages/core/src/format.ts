/**
 * Display formatting helpers. Pure, no I/O — shared by mobile and web so counts
 * and dates read identically everywhere. One rule: no count label is built by
 * inline string concatenation. Everything routes through `pluralize`.
 */

/**
 * "1 country" / "10 countries". Plural defaults to `singular + "s"`; pass an
 * explicit plural for irregulars ("city" → "cities"). The number is included so
 * callers never re-concatenate the count themselves.
 */
export function pluralize(n: number, singular: string, plural?: string): string {
  const word = n === 1 ? singular : plural ?? `${singular}s`;
  return `${n} ${word}`;
}

/** Just the noun, correctly pluralized, without the leading count. */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : pluralForm ?? `${singular}s`;
}

/**
 * Compact relative time for the feed: "just now", "2m", "3h", "2d", "3w", "5mo",
 * "2y". `now` is injected (defaults to Date.now()) so callers/tests stay
 * deterministic. Returns "" for a null/unparseable timestamp.
 */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}
