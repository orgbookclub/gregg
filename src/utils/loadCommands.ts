import glob from "glob";

import { Command, Context } from "../models";

import { logger } from "./logHandler";

const OUT_DIR = "dist";

/**
 * Reads the '/commands' directory and dynamically imports the files,
 * then pushes the imported data into an array.
 *
 * @returns Array of Command objects representing the imported commands.
 */
const loadCommands = async () => {
  try {
    const filePathExp = `./${OUT_DIR}/commands/*.js`;
    return await parseCommandFiles<Command>(filePathExp);
  } catch (err) {
    logger.error(err, `Error while loading commands`);
    return [];
  }
};

/**
 * Reads the '/contexts' directory and dynamically imports the files,
 * then pushes the imported data into an array.
 *
 * @returns Array of Context objects representing the imported commands.
 */
const loadContexts = async () => {
  try {
    const filePathExp = `./${OUT_DIR}/contexts/*.js`;
    return await parseCommandFiles<Context>(filePathExp);
  } catch (err) {
    logger.error(err, `Error while loading context commands`);
    return [];
  }
};

async function parseCommandFiles<T>(filePathExp: string) {
  const commands: T[] = [];
  const files = glob.sync(filePathExp, { realpath: true });
  for (const file of files) {
    const mod = await import(file);
    const name = file.split("/").at(-1)?.split(".")[0] ?? "";
    commands.push(mod[name] as T);
    logger.debug(`Detected command: ${name}...`);
  }
  return commands;
}

export { loadCommands, loadContexts };
