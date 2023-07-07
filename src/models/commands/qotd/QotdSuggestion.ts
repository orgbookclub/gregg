import { QotdSuggestionStatus } from "./QotdSuggestionStatus";

export interface QotdSuggestion {
  question: string;
  status: keyof typeof QotdSuggestionStatus;
  serverId: string;
  userId: string;
  suggestedOn: Date;
}
