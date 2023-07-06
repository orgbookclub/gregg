import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import { EventTypeOptions, EventStatusOptions } from "../config";
import { CommandHandler, Command } from "../models";
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

const userReaderboardCommand = new SlashCommandSubcommandBuilder()
  .setName("readerboard")
  .setDescription("Shows the server reading leaderboard");

const userEventsCommand = new SlashCommandSubcommandBuilder()
  .setName("events")
  .setDescription("Gets the server events for the user")
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
  );

const userStatsCommand = new SlashCommandSubcommandBuilder()
  .setName("stats")
  .setDescription("Gets the server event stats for a user")
  .addUserOption((option) =>
    option.setName("user").setDescription("User for which to fetch info"),
  );

const userInfoCommand = new SlashCommandSubcommandBuilder()
  .setName("info")
  .setDescription("Gets information about a user")
  .addUserOption((option) =>
    option.setName("user").setDescription("User for which to fetch info"),
  );

export const user: Command = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Handles user commands")
    .addSubcommand(userEventsCommand)
    .addSubcommand(userInfoCommand)
    .addSubcommand(userReaderboardCommand)
    .addSubcommand(userStatsCommand)
    .setDMPermission(false),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command user`);
    }
  },
  cooldown: 15,
};
