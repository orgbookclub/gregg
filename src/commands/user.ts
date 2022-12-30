import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { EventStatusOptions } from "../config/EventStatusOptions";
import { EventTypeOptions } from "../config/EventTypeOptions";
import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

import { handleEvents } from "./subcommands/user/events";
import { handleInfo } from "./subcommands/user/info";
import { handleReaderboard } from "./subcommands/user/readerboard";
import { handleStats } from "./subcommands/user/stats";

const handlers: { [key: string]: CommandHandler } = {
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
      logger.error(`Error processing command user ${err}`);
    }
  },
};
