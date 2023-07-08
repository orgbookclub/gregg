import { QotdSuggestionStatus } from "./QotdSuggestionStatus";

export interface QotdSuggestion {
  question: string;
  status: keyof typeof QotdSuggestionStatus;
  guildId: string;
  userId: string;
  createdOn: Date;
}
