import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import { EventTypeOptions, EventStatusOptions } from "../config";
import { CommandHandler, Command } from "../models";
import { errorHandler } from "../utils/errorHandler";

import {
  handleReaderboard,
  handleEvents,
  handleInfo,
} from "./subcommands/user";

const handlers: Record<string, CommandHandler> = {
  info: handleInfo,
  events: handleEvents,
  readerboard: handleReaderboard,
};

const userReaderboardSubcommand = new SlashCommandSubcommandBuilder()
  .setName("readerboard")
  .setDescription("Shows the server reading leaderboard");

const userEventsSubcommand = new SlashCommandSubcommandBuilder()
  .setName("events")
  .setDescription("Fetches the server events for a user")
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

const userInfoSubcommand = new SlashCommandSubcommandBuilder()
  .setName("info")
  .setDescription("Fetches information about a user")
  .addUserOption((option) =>
    option.setName("user").setDescription("User for which to fetch info"),
  );

export const user: Command = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Handles user commands")
    .addSubcommand(userEventsSubcommand)
    .addSubcommand(userInfoSubcommand)
    .addSubcommand(userReaderboardSubcommand)
    .setDMPermission(false),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      await errorHandler(
        bot,
        "commands > user",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
  cooldown: 15,
};
