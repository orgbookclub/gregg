import { Bot } from "..";
import { BackendScoped } from "../../modules/engine/backend";

/**
 * Model used to define a scheduled job.
 */
export interface Job extends BackendScoped {
  name: string;
  cronTime: string | Date;
  callBack: (bot: Bot) => Promise<void>;
}
