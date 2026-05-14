/**
 * Tags that should be filtered out when computing top genres.
 *
 */
const DENY_LIST = new Set(
  [
    "medium-paced",
    "slow-paced",
    "fast-paced",
    "audiobook",
    "ebook",
    "ebooks",
    "paperback",
    "hardcover",
    "adult",
    "novels",
    "novel",
    "school",
    "book club",
    "read for school",
  ].map((s) => s.toLowerCase()),
);

const YEAR_PATTERN = /^(19|20)\d{2}$/;

/**
 * Returns true when the supplied tag should be treated as a real genre
 * and counted in stats; false for mood/pace markers, format-only tags,
 * and overly-generic shelf categories.
 *
 * @param tag The raw tag string from `book.genres`.
 */
export function isGenreTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (DENY_LIST.has(normalized)) return false;
  if (YEAR_PATTERN.test(normalized)) return false;
  return true;
}
