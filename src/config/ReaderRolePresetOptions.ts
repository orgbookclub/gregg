import { DateWindowPresetOptions } from "./DateWindowPresetOptions";

const ALLOWED_KEYS = new Set(["all-time", "this-year", "this-month"]);

export const ReaderRolePresetOptions = DateWindowPresetOptions.filter((o) =>
  ALLOWED_KEYS.has(o.value),
);
