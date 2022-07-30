import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

const handlePing = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  await interaction.reply("Pong!");
};
const handlers: { [key: string]: CommandHandler } = {
  ping: handlePing,
};
export const gregg: Command = {
  data: new SlashCommandBuilder()
    .setName("gregg")
    .setDescription("Shows the help menu for the bot")
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!"),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("help")
        .setDescription("Shows the help menu for the bot"),
    ),
  run: async (bot: Bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(`Error processing command gregg: ${err}`);
    }
  },
};
