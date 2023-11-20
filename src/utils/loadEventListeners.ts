import { sync } from "fast-glob";

import { Bot, Event } from "../models";

import { logger } from "./logHandler";

const OUT_DIR = "./dist";

/**
 * Root level function for loading all of the event listeners.
 *
 * @param bot The bot instance.
 */
export const handleEvents = async (bot: Bot) => {
  try {
    const files = sync(`${OUT_DIR}/events/**/*.js`, { absolute: true });
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
