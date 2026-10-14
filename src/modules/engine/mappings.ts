import { DateWindow, isAllTimeWindow } from "../../utils/dateWindow";

import { EngineStatsWindowQuery, EngineUserSummary } from "./types";

const OWS_TYPE_TO_ENGINE_KEY: Record<string, string> = {
  BuddyRead: "buddy-read",
  MonthlyRead: "book-of-the-month",
  PoetryRead: "poetry-read",
  ShortStoryRead: "short-story-read",
  Other: "other",
};

const ENGINE_TYPE_EMOJI: Record<string, string> = {
  "buddy-read": "👥",
  "book-of-the-month": "🗓️",
  "short-story-read": "📖",
  "poetry-read": "🪶",
  other: "📚",
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Maps an OWS event type (the slash-command choice value) to the engine's
 * event type key. Unknown values pass through unchanged.
 *
 * @param owsType The OWS type, e.g. "BuddyRead".
 * @returns The engine type key, e.g. "buddy-read".
 */
export function engineTypeKey(owsType: string): string {
  return OWS_TYPE_TO_ENGINE_KEY[owsType] ?? owsType;
}

/**
 * Returns the emoji used for an engine event type key.
 *
 * @param typeKey The engine type key.
 * @returns The emoji.
 */
export function engineTypeEmoji(typeKey: string): string {
  return ENGINE_TYPE_EMOJI[typeKey] ?? "📚";
}

/**
 * Formats an engine status ("ongoing") the way Gregg shows OWS statuses
 * ("Ongoing").
 *
 * @param status The engine status.
 * @returns The display label.
 */
export function engineStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Maps Gregg's date-window options onto the engine stats window query.
 * Calendar presets use the engine's club-timezone windows; everything else
 * becomes an inclusive custom range.
 *
 * @param preset The `preset` option value, if any.
 * @param window The resolved date window.
 * @param now The current time.
 * @returns The stats window query.
 */
export function toEngineStatsWindow(
  preset: string | null | undefined,
  window: DateWindow,
  now: Date = new Date(),
): EngineStatsWindowQuery {
  if (preset === "this-year") return { window: "year" };
  if (preset === "last-year") {
    return { window: "year", year: now.getUTCFullYear() - 1 };
  }
  if (preset === "this-month") return { window: "month" };
  if (isAllTimeWindow(window)) return { window: "all_time" };
  const from = window.after ? toCalendarDate(window.after) : "1970-01-01";
  const to = window.before
    ? toCalendarDate(new Date(window.before.getTime() - ONE_DAY_MS))
    : toCalendarDate(now);
  return { window: "custom", from, to };
}

/**
 * Returns the first and last day of the month after the club's `today`.
 *
 * @param today The club-calendar date (`YYYY-MM-DD`).
 * @returns The start and end calendar dates.
 */
export function nextMonthRange(today: string): [string, string] {
  const [year, month] = today.split("-").map(Number);
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return [toCalendarDate(start), toCalendarDate(end)];
}

/**
 * Returns the Discord user id of an engine user, when the engine exposes it
 * (installation callers get `subject` for Discord, contract extension A6).
 *
 * @param user The engine user.
 * @returns The Discord user id, or null.
 */
export function discordIdOf(user: EngineUserSummary): string | null {
  return (
    user.platforms.find((p) => p.provider === "discord" && p.subject)
      ?.subject ?? null
  );
}

/**
 * Renders an engine user as a Discord mention when the Discord id is known,
 * falling back to the display name (and Discord username).
 *
 * @param user The engine user.
 * @returns The rendered user.
 */
export function formatEngineUser(user: EngineUserSummary): string {
  const id = discordIdOf(user);
  if (id) return `<@${id}>`;
  const username = user.platforms.find(
    (p) => p.provider === "discord",
  )?.username;
  return username ? `${user.displayName} (@${username})` : user.displayName;
}

/**
 * Formats a club-calendar date (`YYYY-MM-DD`) as a Discord long-date
 * timestamp. The date is anchored at noon UTC so it never shifts a day.
 *
 * @param date The calendar date.
 * @returns The Discord timestamp markup.
 */
export function formatCalendarDate(date: string): string {
  const ms = Date.parse(`${date}T12:00:00Z`);
  if (Number.isNaN(ms)) return date;
  return `<t:${Math.floor(ms / 1000)}:D>`;
}
