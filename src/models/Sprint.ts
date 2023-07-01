import { uuid4 } from "@sentry/utils";
import { User, userMention } from "discord.js";

import { getUserMentionString } from "../utils/eventUtils";

import { SprintStatus } from ".";

/**
 * Represents a Sprint.
 */
export class Sprint {
  id: string;
  threadId: string;
  participants: Set<string>;
  startCounts: Record<string, number>;
  endCounts: Record<string, number>;
  duration: number;
  timer?: NodeJS.Timeout;
  status: SprintStatus;

  /**
   * Initializes a sprint object.
   *
   * @param duration The duration in minutes for the sprint.
   * @param delayBy The duration in minutes for which to delay before the sprint starts.
   * @param threadId The ID of the channel or thread where the sprint will be.
   */
  constructor(duration: number, delayBy: number, threadId: string) {
    this.id = uuid4();
    this.threadId = threadId;
    this.duration = duration;
    this.participants = new Set();
    this.startCounts = {};
    this.endCounts = {};
    this.timer = undefined;
    this.status = SprintStatus.Scheduled;
  }

  /**
   * Adds a user as a participant in a sprint, and marks their start count.
   *
   * @param user The user object.
   * @param startCount The initial start count of the user.
   */
  join(user: User, startCount: number) {
    this.participants.add(user.id);
    this.startCounts[user.id] = startCount;
  }

  /**
   * Removes a user from a sprint.
   *
   * @param user The user object.
   */
  leave(user: User) {
    this.participants.delete(user.id);
    delete this.startCounts[user.id];
  }

  /**
   * Logs the end count of a sprint participant.
   *
   * @param user The user object.
   * @param endCount The end count of the user.
   */
  finish(user: User, endCount: number) {
    this.endCounts[user.id] = endCount;
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
      `**Number of participants**: ${this.participants.size}`
    );
  }

  /**
   * Creates a message for the sprint start announcement.
   *
   * @returns The string representing the start announcement.
   */
  getStartMessage() {
    return `Sprint started! Duration: ${this.duration} minutes`;
  }

  /**
   * Creates a message for the sprint finish announcement.
   *
   * @returns The string representing the finish announcement.
   */
  getFinishMessage() {
    return (
      `${getUserMentionString(Array.from(this.participants.keys()))}` +
      "\n" +
      `Sprint Finished! Please log your end count`
    );
  }

  /**
   * Calculates the scores for the sprint participants.
   *
   * @returns A sorted list of tuples, representing the ID and the score of a participant.
   */
  calculateSprintScores(): [string, number][] {
    const scores: Record<string, number> = {};
    for (const key of this.participants) {
      if (this.endCounts[key] === undefined) continue;
      scores[key] = Math.max(0, this.endCounts[key] - this.startCounts[key]);
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
   * @returns The string representing the sprint ending stats.
   */
  getEndMessage() {
    const scoreStrings = this.calculateSprintScores().map((item, index) => {
      const readingSpeed = (item[1] / this.duration).toFixed(2);
      return (
        `\`${index + 1}\` ${userMention(item[0])} - **${
          item[1]
        }** (*${readingSpeed}* per minute)` + "\n"
      );
    });
    return (
      "Congratulations sprinters!" +
      "\n" +
      "**SPRINT STATS**" +
      "\n" +
      `${scoreStrings}`
    );
  }
}
