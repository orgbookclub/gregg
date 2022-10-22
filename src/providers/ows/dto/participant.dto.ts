import { UserDto } from "./user.dto";

/**
 * Class which stores information of an event participant.
 */
export interface Participant {
  _id: string | undefined;
  user: string | UserDto;
  points: number;
}
