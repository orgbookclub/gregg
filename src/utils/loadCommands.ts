import glob from "glob";

import { Command } from "../interfaces/Command";

import { logger } from "./logHandler";

const OUT_DIR = "dist";

/**
 * Reads the '/commands' directory and dynamically imports the files,
 * then pushes the imported data into an array.
 *
 * @returns {Command[]} Array of Command objects representing the imported commands.
 */
export const loadCommands = async (): Promise<Command[]> => {
  try {
    const commands: Command[] = [];
    const files = glob.sync(`./${OUT_DIR}/commands/*.js`, { realpath: true });
    for (const file of files) {
      logger.debug(`Looking in file: ${file}`);
      const mod = await import(file);
      const name = file.split("/").at(-1)?.split(".")[0] ?? "";
      commands.push(mod[name] as Command);
      logger.debug(`Detected command: ${name}...`);
    }
    return commands;
  } catch (err) {
    logger.error(`Error while loading commands: ${err}`);
    return [];
  }
};
