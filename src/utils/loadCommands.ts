import glob from "glob";

import { Command } from "../models/Command";
import { Context } from "../models/Context";

import { logger } from "./logHandler";

const OUT_DIR = "dist";

async function parseCommandFiles<T>(filePathExp: string) {
  const commands: T[] = [];
  const files = glob.sync(filePathExp, { realpath: true });
  for (const file of files) {
    logger.debug(`Looking in file: ${file}`);
    const mod = await import(file);
    const name = file.split("/").at(-1)?.split(".")[0] ?? "";
    commands.push(mod[name] as T);
    logger.debug(`Detected command: ${name}...`);
  }
  return commands;
}

/**
 * Reads the '/commands' directory and dynamically imports the files,
 * then pushes the imported data into an array.
 *
 * @returns {Promise<Command[]>} Array of Command objects representing the imported commands.
 */
export const loadCommands = async (): Promise<Command[]> => {
  try {
    const filePathExp = `./${OUT_DIR}/commands/*.js`;
    return await parseCommandFiles<Command>(filePathExp);
  } catch (err) {
    logger.error(`Error while loading commands: ${err}`);
    return [];
  }
};

/**
 * Reads the '/contexts' directory and dynamically imports the files,
 * then pushes the imported data into an array.
 *
 * @returns {Promise<Context[]>} Array of Command objects representing the imported commands.
 */
export const loadContexts = async (): Promise<Context[]> => {
  try {
    const filePathExp = `./${OUT_DIR}/contexts/*.js`;
    return await parseCommandFiles<Context>(filePathExp);
  } catch (err) {
    logger.error(`Error while loading context commands: ${err}`);
    return [];
  }
};
