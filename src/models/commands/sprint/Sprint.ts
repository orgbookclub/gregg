import { userMention } from "discord.js";

import { getUserMentionString } from "../../../utils/userUtils";

import { SprintParticipant } from "./SprintParticipant";
import { SprintStatus } from "./SprintStatus";

/**
 * Represents a Sprint.
 */
export class Sprint {
  duration: number;
  channelId: string;
  guildId: string;
  userId: string;
  participants: Record<string, SprintParticipant>;
  status: SprintStatus;
  timer?: NodeJS.Timeout;
  startedOn?: Date;
  endedOn?: Date;

  /**
   * Initializes a sprint object.
   *
   * @param duration The duration in minutes for the sprint.
   * @param threadId The ID of the channel or thread where the sprint will be.
   * @param guildId The guild Id.
   * @param startedBy The ID of the user who started the sprint.
   */
  constructor(
    duration: number,
    threadId: string,
    guildId: string,
    startedBy: string,
  ) {
    this.channelId = threadId;
    this.guildId = guildId;
    this.duration = duration;
    this.userId = startedBy;
    this.participants = {};
    this.timer = undefined;
    this.status = SprintStatus.Scheduled;
  }

  /**
   * Adds a user as a participant in a sprint, and marks their start count.
   *
   * @param userId The user Id.
   * @param startCount The initial start count of the user.
   */
  join(userId: string, startCount: number) {
    this.participants[userId] = {
      userId: userId,
      startCount: startCount,
      endCount: 0,
      didFinish: false,
    };
  }

  /**
   * Removes a user from a sprint.
   *
   * @param userId The user Id.
   */
  leave(userId: string) {
    delete this.participants[userId];
  }

  /**
   * Logs the end count of a sprint participant.
   *
   * @param userId The user Id.
   * @param endCount The end count of the user.
   */
  finish(userId: string, endCount: number) {
    this.participants[userId].endCount = endCount;
    this.participants[userId].didFinish = true;
  }

  /**
   * Cancels the sprint.
   */
  cancel() {
    this.status = SprintStatus.Cancelled;
    if (this.timer !== undefined) clearTimeout(this.timer);
  }

  /**
   * Creates a message showing the current sprint information.
   *
   * @returns The string representing the sprint status.
   */
  getStatusMessage() {
    return (
      `**Sprint Status**: ${this.status}` +
      "\n" +
      `**Duration** : ${this.duration} minute(s)` +
      "\n" +
      `**Number of participants**: ${Object.keys(this.participants).length}`
    );
  }

  /**
   * Creates a message for the sprint start announcement.
   *
   * @returns The string representing the start announcement.
   */
  getStartMessage() {
    return (
      `📚📚📚 **Sprint started!**  | Duration: ${this.duration} minutes 📚📚📚` +
      "\n" +
      "Please use the `/sprint join` command to join the sprint"
    );
  }

  /**
   * Creates a message for the sprint finish announcement.
   *
   * @returns The string representing the finish announcement.
   */
  getFinishMessage() {
    return (
      // `${getUserMentionString(Array.from(this.participants.keys()))}` +
      `${getUserMentionString(Object.keys(this.participants))}` +
      "\n" +
      `Sprint Finished! Please log your end count within the next 2 minutes using \`/sprint finish\``
    );
  }

  /**
   * Calculates the scores for the sprint participants.
   *
   * @returns A sorted list of tuples, representing the ID and the score of a participant.
   */
  calculateSprintScores(): [string, number][] {
    const scores: Record<string, number> = {};
    for (const userId in this.participants) {
      const currParticipant = this.participants[userId];
      if (!currParticipant.didFinish) continue;
      scores[userId] = Math.max(
        0,
        currParticipant.endCount - currParticipant.startCount,
      );
    }
    const items: [string, number][] = Object.keys(scores).map((key) => [
      key,
      scores[key],
    ]);
    items.sort((a, b) => b[1] - a[1]);
    return items;
  }

  /**
   * Creates a message for the sprint ending announcement with the stats.
   *
   * @param scores The sprint scores.
   * @returns The string representing the sprint ending stats.
   */
  getEndMessage(scores: [string, number][]) {
    const scoreStrings = scores.map((item, index) => {
      const [userId, count] = item;
      const position = index + 1;
      const readingSpeed = (count / this.duration).toFixed(2);
      return (
        `\`${position}\` ${userMention(
          userId,
        )} --> **${count}** *(${readingSpeed} per minute)*` + "\n"
      );
    });
    return (
      "Congratulations Sprinters!" +
      "\n" +
      "**SPRINT STATS**" +
      "\n" +
      `${scoreStrings}`
    );
  }
}
