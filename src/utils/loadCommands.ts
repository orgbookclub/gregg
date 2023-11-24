import { sync } from "fast-glob";

import { Command, Context } from "../models";
import { Job } from "../models/jobs/Job";

import { logger } from "./logHandler";

const OUT_DIR = "./dist";

/**
 * Reads the '/commands' directory and dynamically imports the files,
 * then pushes the imported data into an array.
 *
 * @returns Array of Command objects representing the imported commands.
 */
const loadCommands = async () => {
  try {
    const filePathExp = `${OUT_DIR}/commands/*.js`;
    return await parseActionFiles<Command>(filePathExp);
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
    const filePathExp = `${OUT_DIR}/contexts/*.js`;
    return await parseActionFiles<Context>(filePathExp);
  } catch (err) {
    logger.error(err, `Error while loading context commands`);
    return [];
  }
};

/**
 * Reads the `/jobs` directory and dynamically imports the files,
 * then pushes the imported data into an array.
 *
 * @returns Array of the Job objects representing the imported jobs.
 */
const loadJobs = async () => {
  try {
    const filePathExp = `${OUT_DIR}/jobs/*.js`;
    return await parseActionFiles<Job>(filePathExp);
  } catch (err) {
    logger.error(`Error while loading jobs`);
    return [];
  }
};

async function parseActionFiles<T>(filePathExp: string) {
  const commands: T[] = [];
  const files = sync(filePathExp, { absolute: true });
  for (const file of files) {
    const mod = await import(file);
    const name = file.split("/").at(-1)?.split(".")[0] ?? "";
    commands.push(mod[name] as T);
    logger.debug(`Detected action: ${name}...`);
  }
  return commands;
}

export { loadCommands, loadContexts, loadJobs };
