import { DateRange } from "./date-range.dto";
import { EventDto } from "./event.dto";

export interface CreateEventDto {
  bookUrl: string;
  dates: DateRange;
  description: string;
}
