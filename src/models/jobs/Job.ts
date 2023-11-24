import { Bot } from "..";

/**
 * Model used to define a scheduled job.
 */
export interface Job {
  name: string;
  cronTime: string | Date;
  callBack: (bot: Bot) => Promise<void> | void;
}
