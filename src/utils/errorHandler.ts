import { captureException } from "@sentry/node";
import {
  CommandInteraction,
  ContextMenuCommandInteraction,
  EmbedBuilder,
  Message,
} from "discord.js";

import { Bot } from "../models";

import { logger } from "./logHandler";
import { customSubstring } from "./stringUtils";

/**
 * Takes the error object generated within the code, passes it to Sentry and logs the
 * information in the console. Then,builds an error embed, and sends
 * that to the debug hook.
 *
 * @param bot The bot instance.
 * @param context The string explaining where this error was thrown.
 * @param err The standard error object (generated in a catch statement).
 * @param guild The name of the guild that triggered the issue.
 * @param message Optional message that triggered the issue.
 * @param interaction  Optional interaction that triggered the issue.
 */
const errorHandler = async (
  bot: Bot,
  context: string,
  err: unknown,
  guild?: string,
  message?: Message,
  interaction?: CommandInteraction | ContextMenuCommandInteraction,
) => {
  const error = err as Error;
  logger.error(error, `Error in ${context}`);

  captureException(error);

  const embed = getErrorEmbed(context, error, guild, interaction, message);
  await bot.debugHook.send({ embeds: [embed] });
};

function getErrorEmbed(
  context: string,
  error: Error,
  guild?: string,
  interaction?: CommandInteraction | ContextMenuCommandInteraction,
  message?: Message,
) {
  const errorEmbed = new EmbedBuilder()
    .setTitle(
      `${context} error ${guild ? `in ${guild}` : "from an unknown source"}.`,
    )
    .setDescription(customSubstring(error.message, 2000))
    .setTimestamp()
    .addFields([
      {
        name: "Stack Trace:",
        value: `\`\`\`\n${customSubstring(
          error.stack || "null",
          1000,
        )}\n\`\`\``,
      },
    ]);

  if (message) {
    errorEmbed.addFields([
      {
        name: "Message Content:",
        value: customSubstring(message.content, 1000),
      },
    ]);
  }

  if (interaction) {
    errorEmbed.addFields([
      {
        name: "Interaction Details",
        value: customSubstring(
          `${interaction.commandName} ${
            interaction.isChatInputCommand()
              ? interaction.options.getSubcommand() || ""
              : ""
          }`,
          1000,
        ),
      },
      {
        name: "Interaction Options",
        value: customSubstring(
          interaction.options.data[0].options
            ?.map((o) => `\`${o.name}\`: ${o.value}`)
            .join(", ") || "no options",
          1000,
        ),
      },
    ]);
  }
  return errorEmbed;
}

export { errorHandler };
