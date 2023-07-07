import { Stats } from "./Stats";

export interface UserEventStats {
  totalScore: number;
  stats: Record<string, Stats>;
}
