import { ProfileDto } from "./profile.dto";

/**
 * Dto object for storing user information.
 */
export interface UserDto {
  _id: string;

  userId: number;

  name: string;

  joinDate: Date;

  profile: ProfileDto;
}
