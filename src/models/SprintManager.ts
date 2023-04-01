import Sprint from "./Sprint";
import { SprintStatus } from "./SprintStatus";

/**
 * Handles the storage and access of running sprints.
 */
export default class SprintManager {
  /**
   * Initializes a SprintStore.
   */
  constructor() {
    this.sprints = {};
  }

  sprints: { [id: string]: Sprint };

  /**
   * Returns the sprint with the given thread id.
   *
   * @param {string} threadId The ID of the channel or thread.
   * @returns {Sprint} Found sprint object.
   */
  getSprint(threadId: string): Sprint {
    return this.sprints[threadId];
  }

  /**
   * Returns a value indicating if there is an ongoing active sprint in the given thread.
   *
   * @param {string} threadId The ID of the channel or thread.
   * @returns {boolean} True if there is an existing sprint, false otherwise.
   */
  isActiveSprintPresent(threadId: string): boolean {
    return (
      this.sprints[threadId] !== undefined &&
      (this.sprints[threadId].status === SprintStatus.Ongoing ||
        this.sprints[threadId].status === SprintStatus.Scheduled)
    );
  }

  /**
   * Returns a value indicating if a sprint is present for the given thread.
   *
   * @param {string} threadId The ID of the channel or thread.
   * @param {SprintStatus} status The sprint status.
   * @returns {boolean} Value indicating sprint is present or not.
   */
  isSprintPresent(threadId: string, status: SprintStatus): boolean {
    return (
      this.sprints[threadId] !== undefined &&
      this.sprints[threadId].status === status
    );
  }

  /**
   * Adds a sprint to the store.
   *
   * @param {Sprint} sprint Input sprint object.
   */
  add(sprint: Sprint) {
    this.sprints[sprint.threadId] = sprint;
  }

  /**
   * Removes a sprint from the store.
   *
   * @param {Sprint} sprint The sprint to be deleted.
   */
  remove(sprint: Sprint) {
    delete this.sprints[sprint.threadId];
  }
}
