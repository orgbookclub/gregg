import { DateWindowPresetOptions } from "./DateWindowPresetOptions";

/**
 * Preset choices exposed on sprint-flavored commands (`/sprint stats`,
 * `/sprint leaderboard`). Extends the calendar set with rolling-day
 * presets that fit sprint cadence (where activity changes faster than
 * for events).
 */
export const SprintPresetOptions = [
  ...DateWindowPresetOptions,
  { name: "Past 7 Days", value: "past-7-days" },
  { name: "Past 30 Days", value: "past-30-days" },
  { name: "Past 90 Days", value: "past-90-days" },
];
