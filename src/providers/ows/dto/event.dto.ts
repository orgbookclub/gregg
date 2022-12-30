import { BookDto } from "./book.dto";
import { DateRange } from "./date-range.dto";
import { EventStatus } from "./event-status";
import { EventType } from "./event-type";
import { Participant } from "./participant.dto";

/**
 * Dto object which stores info for an event.
 */
export interface EventDto {
  _id: string;
  name: string;
  book: BookDto;
  threads: string[];
  status: EventStatus;
  type: EventType;
  dates: DateRange;
  requestedBy: Participant;
  interested: Participant[];
  readers: Participant[];
  leaders: Participant[];
  description: string;
}
