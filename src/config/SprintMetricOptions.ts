export type SprintMetric = "pages" | "minutes" | "completed";

export const SprintMetricOptions = [
  { name: "Pages read", value: "pages" },
  { name: "Minutes sprinted", value: "minutes" },
  { name: "Sprints completed", value: "completed" },
] as const satisfies readonly { name: string; value: SprintMetric }[];
