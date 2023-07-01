import { captureException } from "@sentry/node";
import { CommandInteraction, ContextMenuCommandInteraction } from "discord.js";

import { Bot } from "../models/Bot";

import { logger } from "./logHandler";

/**
 * Takes the error object generated within the code, passes it to Sentry and logs the
 * information in the console.
 *
 * @param bot The bot instance.
 * @param context The string explaining where this error was thrown.
 * @param err The standard error object (generated in a catch statement).
 * @param guild The name of the guild that triggered the issue.
 * @param message Optional message that triggered the issue.
 * @param interaction  Optional interaction that triggered the issue.
 */
export const errorHandler = (
  bot: Bot,
  context: string,
  err: unknown,
  guild?: string,
  message?: string,
  interaction?: CommandInteraction | ContextMenuCommandInteraction,
) => {
  const error = err as Error;
  logger.error({
    context: context,
    guild: guild,
    interaction: interaction?.commandName,
    message: message,
    errorMessage: error.message,
    errorStack: error.stack,
  });

  captureException(error);
};
