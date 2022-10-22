import { BookDto } from "./book.dto";
import { DateRange } from "./date-range.dto";
import { EventStatus } from "./event-status";
import { EventType } from "./event-type";

/**
 * Dto object which stores info for an event.
 */
export interface EventDto {
  _id: string | undefined;
  name: string;
  book: BookDto;
  threads: string[];
  status: EventStatus;
  type: EventType;
  dates: DateRange;
  requestedBy: string;
  interested: string[];
  readers: string[];
  leaders: string[];
  description: string;
}
