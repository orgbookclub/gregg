import { Sprint, SprintStatus } from ".";

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
   * Returns a value indicating if there is an ongoing active sprint in the given thread.
   *
   * @param threadId The ID of the channel or thread.
   * @returns True if there is an existing sprint, false otherwise.
   */
  isActiveSprintPresent(threadId: string) {
    return (
      this.sprints[threadId] !== undefined &&
      (this.sprints[threadId].status === SprintStatus.Ongoing ||
        this.sprints[threadId].status === SprintStatus.Scheduled)
    );
  }

  /**
   * Returns a value indicating if a sprint is present for the given thread.
   *
   * @param threadId The ID of the channel or thread.
   * @param status The sprint status.
   * @returns Value indicating sprint is present or not.
   */
  isSprintPresent(threadId: string, status: SprintStatus) {
    return (
      this.sprints[threadId] !== undefined &&
      this.sprints[threadId].status === status
    );
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
