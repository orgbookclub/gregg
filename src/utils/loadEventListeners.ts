import glob from "glob";

import { Bot, Event } from "../models";

import { logger } from "./logHandler";

const OUT_DIR = "dist";

/**
 * Root level function for loading all of the event listeners.
 *
 * @param bot The bot instance.
 */
export const handleEvents = async (bot: Bot) => {
  try {
    const files = glob.sync(`./${OUT_DIR}/events/**/*.js`, { realpath: true });
    for (const file of files) {
      const mod = await import(file);
      const name = file.split("/").at(-1)?.split(".")[0] ?? "";
      const event: Event = mod[name];
      bot.on(event.name, async (...args) => await event.run(bot, ...args));
    }
  } catch (err) {
    logger.error(err, `Error while loading event listeners`);
  }
};
