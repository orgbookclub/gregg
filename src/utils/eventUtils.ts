import { userMention } from "discord.js";

import { Participant } from "../providers/ows/dto/participant.dto";

/**
 * Converts a javascript date object into unix timestamp.
 *
 * @param {Date} date A JS date object.
 * @returns {string} Unix timestamp.
 */
export const getUnixTimestamp = (date: Date): string => {
  return Math.floor(new Date(date).getTime() / 1000).toString();
};

/**
 * Converts a particpant array to a comma separated user mention string.
 *
 * @param {Participant[]| string[]} participants Particpant list.
 * @param {boolean} includePoints Indicates whether to include particpant points in the string.
 * @param {number} limit The max number of users to show in the string.
 * @returns {string} Result string.
 */
export const getUserMentionString = (
  participants: Participant[] | string[],
  includePoints = false,
  limit = 25,
): string => {
  const limitedParticipants = participants.slice(0, limit);
  let result = limitedParticipants
    .map((participant) => {
      if (
        typeof participant !== "string" &&
        typeof participant.user !== "string"
      ) {
        if (includePoints) {
          return `${userMention(participant.user.userId.toString())}(${
            participant.points
          })`;
        }
        return userMention(participant.user.userId.toString());
      }
      return null;
    })
    .join(",");
  if (participants.length > limit) result += "...";
  return result;
};
