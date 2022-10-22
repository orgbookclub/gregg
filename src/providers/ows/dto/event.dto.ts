import { BookDto } from "./book.dto";
import { DateRange } from "./date-range.dto";
import { EventStatus } from "./event-status";
import { EventType } from "./event-type";
import { Participant } from "./participant.dto";

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
  requestedBy: string | Participant;
  interested: string[] | Participant[];
  readers: string[] | Participant[];
  leaders: string[] | Participant[];
  description: string;
}
