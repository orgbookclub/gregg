import { Participant, ParticipantDto } from "@orgbookclub/ows-client";
import { GuildMember, userMention } from "discord.js";

import { OWSClient } from "../providers/owsClient";

import { logger } from "./logHandler";

/**
 * Checks if a Guild Member has a certain role or not.
 *
 * @param member The guild member.
 * @param roleId The Role id.
 * @returns True if member has role, false otherwise.
 */
export function hasRole(member: GuildMember, roleId: string) {
  if (!member || !roleId) return false;
  return member.roles.cache.some((role) => role.id === roleId);
}

/**
 * Gets the user object from the server.
 * If user does not exist, creates one with default values.
 *
 * @param api The OWS client.
 * @param userId The user id.
 * @param username The username.
 * @returns The User document.
 */
export async function upsertUser(
  api: OWSClient,
  userId: string,
  username: string,
) {
  const existingUser = await getUserByDiscordId(api, userId);
  if (existingUser === undefined || existingUser === null) {
    logger.debug(`Creating new user ${userId}`);
    const userCreateResponse = await api.users.usersControllerCreate({
      createUserDto: {
        userId: userId,
        name: username,
        joinDate: new Date().toISOString(),
        profile: { bio: "" },
      },
    });
    return userCreateResponse.data;
  } else {
    return existingUser;
  }
}

/**
 * Converts a particpant array or a user array to a comma separated user mention string.
 *
 * @param participants Participant list or a user list.
 * @param includePoints Indicates whether to include particpant points in the string.
 * @param limit The max number of users to show in the string.
 * @returns Result string.
 */
export const getUserMentionString = (
  participants: Participant[] | string[],
  includePoints = false,
  limit = 25,
) => {
  const limitedParticipants = participants.slice(0, limit);
  return limitedParticipants
    .map((participant) => {
      if (typeof participant === "string") {
        return userMention(participant);
      }
      const userId = participant.user.userId.toString();
      return includePoints
        ? `${userMention(userId)}(${participant.points})`
        : userMention(userId);
    })
    .join(",");
};

/**
 * Converts a participant object to its corresponding dto.
 *
 * @param participant The participant object.
 * @returns The participant dto.
 */
export function participantToDto(participant: Participant) {
  const participantDto: ParticipantDto = {
    ...participant,
    user: participant.user._id,
  };
  return participantDto;
}

/**
 * Gets a user by their Discord ID.
 *
 * @param api The ows client.
 * @param id The discord ID of the user.
 * @returns The user if found, undefined otherwise.
 */
export async function getUserByDiscordId(api: OWSClient, id: string) {
  try {
    const userResponse = await api.users.usersControllerFindOneByUserId({
      userid: id,
    });
    if (userResponse.data) {
      return userResponse.data;
    } else {
      throw new Error("Not found!");
    }
  } catch (_error) {
    return undefined;
  }
}
