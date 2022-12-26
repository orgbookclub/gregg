import { DateRange } from "./date-range.dto";
import { EventType } from "./event-type";

export interface CreateEventDto {
  bookUrl: string;
  type: EventType;
  dates: DateRange;
  requestedBy: string;
  leaders: string[];
  description: string;
}
