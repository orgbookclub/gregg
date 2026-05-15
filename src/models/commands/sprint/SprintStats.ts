export interface SprintRecord {
  pages: number;
  duration: number;
  pagesPerMinute: number;
  endedOn: Date;
}

export interface SprintStats {
  participatedCount: number;
  finishedCount: number;
  finishedDuration: number;
  pageCount: number;
  avgSpeed: string;
  bestByPages: SprintRecord | null;
  fastestByPpm: SprintRecord | null;
  currentStreakWeeks: number;
  longestStreakWeeks: number;
}
