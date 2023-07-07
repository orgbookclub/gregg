import { Sprint } from "./Sprint";
import { SprintStatus } from "./SprintStatus";

/**
 * Handles the storage and access of running sprints.
 */
export class SprintManager {
  /**
   * Initializes a SprintStore.
   */
  constructor() {
    this.sprints = {};
  }

  sprints: Record<string, Sprint>;

  /**
   * Returns the sprint with the given thread id.
   *
   * @param threadId The ID of the channel or thread.
   * @returns Found sprint object.
   */
  getSprint(threadId: string) {
    return this.sprints[threadId];
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
   * Adds a sprint to the store.
   *
   * @param sprint Input sprint object.
   */
  add(sprint: Sprint) {
    this.sprints[sprint.threadId] = sprint;
  }

  /**
   * Removes a sprint from the store.
   *
   * @param sprint The sprint to be deleted.
   */
  remove(sprint: Sprint) {
    delete this.sprints[sprint.threadId];
  }
}
