import { Bot } from "../..";

import { Sprint } from "./Sprint";
import { SprintStatus } from "./SprintStatus";

/**
 * Handles the sprints.
 */
export class SprintManager {
  private sprints: Record<string, Sprint>;

  /**
   * Initializes a SprintStore.
   */
  constructor() {
    this.sprints = {};
  }

  /**
   * Returns a value indicating if a sprint with the status is present for the given thread.
   *
   * @param threadId The ID of the channel or thread.
   * @param status The sprint status.
   * @returns Boolean indicating sprint is present or not.
   */
  isSprintPresent(threadId: string, status: SprintStatus) {
    return this.sprints[threadId]?.status === status;
  }

  /**
   * Creates a sprint and adds it to the store.
   *
   * @param duration The duration of the sprint.
   * @param guildId The guild Id.
   * @param threadId The thread Id where the sprint is.
   * @param userId The Id of the user who started the sprint.
   * @returns The created sprint ID.
   */
  createSprint(
    duration: number,
    guildId: string,
    threadId: string,
    userId: string,
  ) {
    if (this.sprints[threadId] !== undefined) {
      throw new Error("A sprint is already active in this thread!");
    }
    const sprint = new Sprint(duration, threadId, guildId, userId);
    this.sprints[sprint.channelId] = sprint;
    return sprint.channelId;
  }

  /**
   * Schedules a sprint.
   *
   * @param sprintId The id of a sprint.
   * @param bot The bot instance.
   * @param delayBy The minutes to delay the start of the sprint.
   */
  scheduleSprint(sprintId: string, bot: Bot, delayBy: number) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];
    sprint.status = SprintStatus.Scheduled;
    sprint.timer = setTimeout(
      () => {
        bot.sprintManager.startSprint(sprintId, bot);
      },
      delayBy * 60 * 1000,
    );
  }

  /**
   * Marks a sprint as Ongoing, sets the timer for the sprint finish, and posts the start message in the thread.
   *
   * @param sprintId The id of the sprint.
   * @param bot The bot instance.
   */
  async startSprint(sprintId: string, bot: Bot) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];
    sprint.status = SprintStatus.Ongoing;
    sprint.startedOn = new Date();

    const channel = await this.fetchSprintChannel(bot, sprint.channelId);
    await channel.send({ content: sprint.getStartMessage() });

    sprint.timer = setTimeout(
      () => {
        bot.sprintManager.finishSprint(sprintId, bot);
      },
      sprint.duration * 60 * 1000,
    );
  }

  /**
   * Returns the participants of the sprint.
   *
   * @param sprintId The ID of the sprint.
   * @returns A dictionary of participants.
   */
  getSprintParticipants(sprintId: string) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    return this.sprints[sprintId].participants;
  }

  /**
   * Logs the start count of a user.
   *
   * @param sprintId The Id of the sprint.
   * @param userId The ID of the user.
   * @param count The count to log.
   */
  logStartCount(sprintId: string, userId: string, count: number) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];
    sprint.join(userId, count);
  }

  /**
   * Logs the end count of a user.
   *
   * @param sprintId The Id of the sprint.
   * @param userId The ID of the user.
   * @param count The count to log.
   */
  logEndCount(sprintId: string, userId: string, count: number) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];

    sprint.finish(userId, count);
  }

  /**
   * Removes a user from the sprint.
   *
   * @param sprintId The id of the sprint.
   * @param userId The user id.
   */
  removeUserFromSprint(sprintId: string, userId: string) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];
    sprint.leave(userId);
  }

  /**
   * Gets the sprint status message.
   *
   * @param sprintId The id of the sprint.
   * @returns The status message.
   */
  getSprintStatus(sprintId: string) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];
    return sprint.getStatusMessage();
  }

  /**
   * Cancels a sprint from the store.
   *
   * @param sprintId The Id of the sprint to be deleted.
   * @param bot The bot instance.
   */
  async cancelSprint(sprintId: string, bot: Bot) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];
    sprint.status = SprintStatus.Cancelled;

    sprint.cancel();
    await bot.db.sprints.create({
      data: {
        duration: sprint.duration,
        channelId: sprint.channelId,
        userId: sprint.userId,
        guildId: sprint.guildId,
        participants: Object.values(sprint.participants),
        startedOn: sprint.startedOn ?? new Date(),
        endedOn: sprint.endedOn ?? new Date(),
        status: sprint.status,
      },
    });
    delete this.sprints[sprintId];
  }

  /**
   * Marks a sprint as finished, starts the timer for sprint end, and posts the finish message in the thread.
   *
   * @param sprintId The ID of the sprint.
   * @param bot The bot instance.
   */
  async finishSprint(sprintId: string, bot: Bot) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];
    sprint.status = SprintStatus.Finished;

    const channel = await this.fetchSprintChannel(bot, sprint.channelId);
    const minutesToWait = 5;
    await channel.send({ content: sprint.getFinishMessage(minutesToWait) });

    sprint.timer = setTimeout(
      () => {
        bot.sprintManager.endSprint(sprintId, bot);
      },
      minutesToWait * 60 * 1000,
    );
  }

  /**
   * Marks a sprint as completed, calculates and sends the scores in the thread, and stores it in the db.
   *
   * @param sprintId The Id of the sprint.
   * @param bot The bot instance.
   */
  async endSprint(sprintId: string, bot: Bot) {
    if (!this.sprints[sprintId]) {
      throw new Error("Unable to find the sprint!");
    }
    const sprint = this.sprints[sprintId];
    sprint.endedOn = new Date();
    sprint.status = SprintStatus.Completed;

    const scores = sprint.calculateSprintScores();
    const channel = await this.fetchSprintChannel(bot, sprint.channelId);
    await channel.send({
      content: `${sprint.getEndMessage(scores)}`,
    });

    await bot.db.sprints.create({
      data: {
        duration: sprint.duration,
        channelId: sprint.channelId,
        userId: sprint.userId,
        guildId: sprint.guildId,
        participants: Object.values(sprint.participants),
        startedOn: sprint.startedOn ?? new Date(),
        endedOn: sprint.endedOn ?? new Date(),
        status: sprint.status,
      },
    });

    delete this.sprints[sprintId];
  }

  /**
   * Fetches the channel for the sprint.
   *
   * @param bot The bot instance.
   * @param threadId The thread Id.
   * @returns The text channel.
   */
  private async fetchSprintChannel(bot: Bot, threadId: string) {
    const channel = await bot.channels.fetch(threadId);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      throw new Error(
        `Unable to find sprint text channel or thread ${threadId}`,
      );
    }
    return channel;
  }
}
