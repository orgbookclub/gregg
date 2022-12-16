import { uuid4 } from "@sentry/utils";
import { User } from "discord.js";

import { SprintStatus } from "./SprintStatus";

/**
 * Represents a Sprint.
 */
export default class Sprint {
  id: string;
  threadId: string;
  participants: Set<string>;
  startCounts: { [id: string]: number };
  endCounts: { [id: string]: number };
  duration: number;
  timer: NodeJS.Timeout | undefined;
  status: SprintStatus;

  /**
   * Initializes a sprint object.
   *
   * @param {number} duration The duration in minutes for the sprint.
   * @param {number} delayBy The duration in minutes for which to delay before the sprint starts.
   * @param {string} threadId The ID of the channel or thread where the sprint will be.
   */
  constructor(duration: number, delayBy: number, threadId: string) {
    this.id = uuid4();
    this.threadId = threadId;
    this.duration = duration;
    this.participants = new Set<string>();
    this.startCounts = {};
    this.endCounts = {};
    this.timer = undefined;
    this.status = SprintStatus.Scheduled;
  }

  /**
   * Adds a user as a participant in a sprint, and marks their start count.
   *
   * @param {User} user The user object.
   * @param {number} startCount The initial start count of the user.
   */
  join(user: User, startCount: number) {
    this.participants.add(user.id);
    this.startCounts[user.id] = startCount;
  }

  /**
   * Removes a user from a sprint.
   *
   * @param {User} user The user object.
   */
  leave(user: User) {
    this.participants.delete(user.id);
    delete this.startCounts[user.id];
  }

  /**
   * Logs the end count of a sprint participant.
   *
   * @param {User} user The user object.
   * @param {number} endCount The end count of the user.
   */
  finish(user: User, endCount: number) {
    this.endCounts[user.id] = endCount;
  }
  /**
   *
   */
  cancel() {
    this.status = SprintStatus.Cancelled;
    if (this.timer !== undefined) clearTimeout(this.timer);
  }

  /**
   * Creates a message showing the current sprint information.
   *
   * @returns {string} The string representing the sprint status.
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
}
