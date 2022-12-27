import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

import { handleInfo } from "./subcommands/user/info";

const handlers: { [key: string]: CommandHandler } = {
  info: handleInfo,
};

export const user: Command = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Handles user commands")
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("info")
        .setDescription("Gets information about a user")
        .addUserOption((option) =>
          option.setName("user").setDescription("User for which to fetch info"),
        ),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("score")
        .setDescription("Shows the user's reader points")
        .addUserOption((option) =>
          option.setName("user").setDescription("User for which to fetch info"),
        ),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("events")
        .setDescription("Shows the events for a user")
        .addUserOption((option) =>
          option.setName("user").setDescription("User for which to fetch info"),
        ),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("readerboard")
        .setDescription("Shows the server reading leaderboard"),
    ),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(`Error processing command user ${err}`);
    }
  },
};
