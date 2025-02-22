import { CronJob } from "cron";

import { Bot, Job } from "..";
import { logger } from "../../utils/logHandler";

/**
 *
 */
export class JobManager {
  private jobs: Record<string, CronJob>;

  /**
   * Initializes an instance of a JobManager.
   *
   * @param bot The bot instance.
   * @param jobs The list of jobs to store and initialize.
   */
  constructor(bot: Bot, jobs: Job[]) {
    this.jobs = {};
    jobs.forEach((job) => {
      logger.debug(`Creating CronJob for ${job.name}`);
      this.jobs[job.name] = new CronJob(job.cronTime, () => job.callBack(bot));
      this.startJob(job.name);
    });
  }

  // /**
  //  *
  //  * @param name
  //  */
  // getJob(name: string) {
  //   try {
  //     return this.jobs[name];
  //   } catch (error) {
  //     throw new Error(`Unable to get job: ${name}`);
  //   }
  // }

  /**
   * Starts a job with the given name.
   *
   * @param name The name of the job.
   */
  startJob(name: string) {
    try {
      this.jobs[name].start();
    } catch (_error) {
      throw new Error(`Unable to start job: ${name}`);
    }
  }

  // /**
  //  *
  //  * @param name
  //  */
  // stopJob(name: string) {
  //   try {
  //     this.jobs[name].stop();
  //   } catch (error) {
  //     throw new Error(`Unable to stop job: ${name}`);
  //   }
  // }
}
