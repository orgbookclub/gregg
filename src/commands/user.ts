import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { EventTypeOptions, EventStatusOptions } from "../config";
import { CommandHandler, Command, Bot } from "../models";
import { logger } from "../utils/logHandler";

import {
  handleStats,
  handleReaderboard,
  handleEvents,
  handleInfo,
} from "./subcommands/user";

const handlers: Record<string, CommandHandler> = {
  info: handleInfo,
  stats: handleStats,
  events: handleEvents,
  readerboard: handleReaderboard,
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
        .setName("stats")
        .setDescription("Shows the user's event stats for the server")
        .addUserOption((option) =>
          option.setName("user").setDescription("User for which to fetch info"),
        ),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("events")
        .setDescription("Shows the events for a user")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Event Type")
            .addChoices(...EventTypeOptions)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("status")
            .setDescription("Event Status")
            .addChoices(...EventStatusOptions)
            .setRequired(true),
        )
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
      logger.error(err, `Error processing command user`);
    }
  },
};
