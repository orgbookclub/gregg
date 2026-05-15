import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { DateWindowPresetOptions } from "../config";

/**
 * A normalized time window used by stats / leaderboard queries.
 * `after` is the inclusive lower bound; `before` is the exclusive upper bound.
 * Either, both, or neither may be set — the absence of bounds means
 * "all time".
 */
type DateWindow = {
  label: string;
  after?: Date;
  before?: Date;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const ALL_TIME_WINDOW: DateWindow = { label: "All Time" };

function rollingDaysWindow(days: number, label: string): DateWindow {
  const now = Date.now();
  return { label, after: new Date(now - days * ONE_DAY_MS) };
}

const PRESET_WINDOWS: Record<string, () => DateWindow> = {
  "all-time": () => ALL_TIME_WINDOW,
  "this-year": () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { label: "This Year", after: start };
  },
  "last-year": () => {
    const now = new Date();
    const startLast = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    const startThis = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { label: "Last Year", after: startLast, before: startThis };
  },
  "this-month": () => {
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    return { label: "This Month", after: start };
  },
  "past-7-days": () => rollingDaysWindow(7, "Past 7 Days"),
  "past-30-days": () => rollingDaysWindow(30, "Past 30 Days"),
  "past-90-days": () => rollingDaysWindow(90, "Past 90 Days"),
};

/**
 * Resolves a preset key to a {@link DateWindow} without needing an
 * interaction. Unknown / null / undefined keys all fall back to "All Time".
 * Use this from non-Discord call sites such as cron jobs or configuration
 * persistence.
 *
 * @param presetKey The preset choice value, or null/undefined.
 * @returns The corresponding window.
 */
function windowFromPreset(presetKey: string | null | undefined): DateWindow {
  if (!presetKey) return ALL_TIME_WINDOW;
  const factory = PRESET_WINDOWS[presetKey];
  return factory ? factory() : ALL_TIME_WINDOW;
}

type DateParseResult =
  | { ok: true; value: Date | null }
  | { ok: false; error: string };

function parseDateInput(label: string, raw: string | null): DateParseResult {
  if (!raw) return { ok: true, value: null };
  if (!DATE_INPUT_PATTERN.test(raw)) {
    return {
      ok: false,
      error: `\`${label}\` must be in YYYY-MM-DD format (got \`${raw}\`).`,
    };
  }
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return {
      ok: false,
      error: `\`${label}\` is not a valid date (got \`${raw}\`).`,
    };
  }
  return { ok: true, value: d };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const QUARTER_BOUNDS: Array<{ startMonth: number; endMonth: number }> = [
  { startMonth: 0, endMonth: 2 },
  { startMonth: 3, endMonth: 5 },
  { startMonth: 6, endMonth: 8 },
  { startMonth: 9, endMonth: 11 },
];

function lastDayOfUtcMonth(year: number, monthZeroBased: number): number {
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

/**
 * Detects whether a closed `from`/`to` range aligns to a calendar
 * boundary (full year, full month, full quarter) and returns a friendly
 * label for it. Returns `null` for arbitrary ranges so the caller falls
 * back to the raw `YYYY-MM-DD → YYYY-MM-DD` rendering.
 *
 * @param from The inclusive start date (UTC).
 * @param to The inclusive end date (UTC).
 */
function smartRangeLabel(from: Date, to: Date): string | null {
  const fy = from.getUTCFullYear();
  const fm = from.getUTCMonth();
  const fd = from.getUTCDate();
  const ty = to.getUTCFullYear();
  const tm = to.getUTCMonth();
  const td = to.getUTCDate();

  if (fy !== ty) return null;

  if (fm === 0 && fd === 1 && tm === 11 && td === 31) {
    return `${fy}`;
  }

  if (fm === tm && fd === 1 && td === lastDayOfUtcMonth(fy, fm)) {
    return `${MONTH_NAMES[fm]} ${fy}`;
  }

  for (let q = 0; q < QUARTER_BOUNDS.length; q += 1) {
    const { startMonth, endMonth } = QUARTER_BOUNDS[q];
    if (
      fm === startMonth &&
      fd === 1 &&
      tm === endMonth &&
      td === lastDayOfUtcMonth(fy, endMonth)
    ) {
      return `Q${q + 1} ${fy}`;
    }
  }

  return null;
}

function buildCustomWindow(
  fromRaw: string,
  toRaw: string,
  fromDate: Date | null,
  toDate: Date | null,
): DateWindow {
  let label: string;
  if (fromRaw && toRaw && fromDate && toDate) {
    label = smartRangeLabel(fromDate, toDate) ?? `${fromRaw} → ${toRaw}`;
  } else if (fromRaw) {
    label = `Since ${fromRaw}`;
  } else {
    label = `Until ${toRaw}`;
  }

  const win: DateWindow = { label };
  if (fromDate) win.after = fromDate;
  if (toDate) win.before = new Date(toDate.getTime() + ONE_DAY_MS);
  return win;
}

/**
 * Reads `preset` / `from` / `to` options off a chat-input interaction and
 * resolves them to a {@link DateWindow}. Returns an `ok: false` result with
 * a user-facing error string when the inputs are invalid or contradictory —
 * for example preset combined with from/to, a malformed date, or from > to.
 *
 * @param interaction The chat input interaction to read options from.
 * @returns The resolved window, or a user-facing error.
 */
function resolveDateWindow(
  interaction: ChatInputCommandInteraction,
): { ok: true; window: DateWindow } | { ok: false; error: string } {
  const preset = interaction.options.getString("preset");
  const fromRaw = interaction.options.getString("from");
  const toRaw = interaction.options.getString("to");

  if (preset && (fromRaw || toRaw)) {
    return {
      ok: false,
      error:
        "`preset` cannot be combined with `from`/`to` — pick a preset or supply a custom range, not both.",
    };
  }

  if (fromRaw || toRaw) {
    const fromParsed = parseDateInput("from", fromRaw);
    if (!fromParsed.ok) return { ok: false, error: fromParsed.error };
    const toParsed = parseDateInput("to", toRaw);
    if (!toParsed.ok) return { ok: false, error: toParsed.error };
    if (
      fromParsed.value &&
      toParsed.value &&
      fromParsed.value > toParsed.value
    ) {
      return { ok: false, error: "`from` must be on or before `to`." };
    }
    return {
      ok: true,
      window: buildCustomWindow(
        fromRaw ?? "",
        toRaw ?? "",
        fromParsed.value,
        toParsed.value,
      ),
    };
  }

  return { ok: true, window: windowFromPreset(preset) };
}

/**
 * Returns true when the window has no bounds (i.e. "All Time").
 *
 * @param window The window to check.
 */
function isAllTimeWindow(window: DateWindow): boolean {
  return window.after === undefined && window.before === undefined;
}

/**
 * Wraps a base title with the window label when the window is bounded.
 * For "All Time" the base title is returned unchanged.
 *
 * @param baseTitle The unwindowed title (e.g. "Server Readerboard").
 * @param window The window to render.
 * @returns The composed title.
 */
function formatWindowTitle(baseTitle: string, window: DateWindow): string {
  return isAllTimeWindow(window) ? baseTitle : `${baseTitle} (${window.label})`;
}

/**
 * Adapter: maps a window onto the OWS events V2 endDate filter pair.
 * Returns ISO strings ready to spread into an `EventsFindFilters` object.
 *
 * @param window The window to map.
 * @returns The endDateAfter / endDateBefore filter fragment.
 */
function toEventEndDateFilter(window: DateWindow): {
  endDateAfter?: string;
  endDateBefore?: string;
} {
  const out: { endDateAfter?: string; endDateBefore?: string } = {};
  if (window.after) out.endDateAfter = window.after.toISOString();
  if (window.before) out.endDateBefore = window.before.toISOString();
  return out;
}

/**
 * Adapter: maps a window onto a Prisma date range fragment.
 * `after` becomes `gte` (inclusive lower bound); `before` becomes `lt`
 * (exclusive upper bound). Returns `undefined` when the window is all-time
 * so callers can conditionally spread the result onto a `where` clause.
 *
 * @param window The window to map.
 * @returns The Prisma range fragment, or `undefined` when unbounded.
 */
function toPrismaDateRange(
  window: DateWindow,
): { gte?: Date; lt?: Date } | undefined {
  if (isAllTimeWindow(window)) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (window.after) range.gte = window.after;
  if (window.before) range.lt = window.before;
  return range;
}

/**
 * Adds the standard `preset` / `from` / `to` options to a subcommand
 * builder. Use this on any subcommand whose handler delegates to
 * {@link resolveDateWindow} to read them back.
 *
 * @param builder The subcommand builder to extend.
 * @param presets The preset choices to expose. Defaults to the calendar
 *   preset set; pass `SprintPresetOptions` (or another superset) for
 *   commands that benefit from rolling presets like Past 7/30/90 Days.
 * @returns The same builder, for chaining.
 */
function addDateWindowOptions(
  builder: SlashCommandSubcommandBuilder,
  presets: readonly { name: string; value: string }[] = DateWindowPresetOptions,
): SlashCommandSubcommandBuilder {
  return builder
    .addStringOption((option) =>
      option
        .setName("preset")
        .setDescription("Calendar window (mutually exclusive with from/to)")
        .addChoices(...presets),
    )
    .addStringOption((option) =>
      option
        .setName("from")
        .setDescription("Custom range start date (YYYY-MM-DD), inclusive"),
    )
    .addStringOption((option) =>
      option
        .setName("to")
        .setDescription("Custom range end date (YYYY-MM-DD), inclusive"),
    );
}

export {
  DateWindow,
  addDateWindowOptions,
  formatWindowTitle,
  isAllTimeWindow,
  resolveDateWindow,
  toEventEndDateFilter,
  toPrismaDateRange,
  windowFromPreset,
};
