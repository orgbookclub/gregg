import { UserDto } from "./user.dto";

/**
 * Class which stores information of an event participant.
 */
export interface Participant {
  user: UserDto;
  points: number;
}
