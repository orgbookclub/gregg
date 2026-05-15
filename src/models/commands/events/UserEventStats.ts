import { Stats } from "./Stats";

export interface UserEventStats {
  totalScore: number;
  totalPages: number;
  topAuthors: Array<{ name: string; url?: string; count: number }>;
  topGenres: Array<{ name: string; count: number }>;
  stats: Record<string, Stats>;
}
