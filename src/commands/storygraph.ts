import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import { CommandHandler, Command } from "../models";
import { logger } from "../utils/logHandler";

import {
  handleBook,
  handleCover,
  handleLink,
  handleSearch,
} from "./subcommands/storygraph";

const handlers: Record<string, CommandHandler> = {
  search: handleSearch,
  book: handleBook,
  cover: handleCover,
  link: handleLink,
};

const storygraphSearchSubcommand = new SlashCommandSubcommandBuilder()
  .setName("search")
  .setDescription("Fetches a list of book links from SG")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("limit")
      .setDescription("Maximum number of results to display")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(7),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephermal")
      .setDescription(
        "Whether the response should be ephermal or not. Default is true",
      )
      .setRequired(false),
  );

const storygraphLinkSubcommand = new SlashCommandSubcommandBuilder()
  .setName("link")
  .setDescription("Fetches a single book link from SG")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephermal")
      .setDescription(
        "Whether the response should be ephermal or not. Default is true",
      )
      .setRequired(false),
  );

const storygraphBookSubcommand = new SlashCommandSubcommandBuilder()
  .setName("book")
  .setDescription("Fetches details of a book from SG")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephermal")
      .setDescription(
        "Whether the response should be ephermal or not. Default is true",
      )
      .setRequired(false),
  );

const storygraphCoverSubcommand = new SlashCommandSubcommandBuilder()
  .setName("cover")
  .setDescription("Fetches cover of a book from SG")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephermal")
      .setDescription(
        "Whether the response should be ephermal or not. Default is true",
      )
      .setRequired(false),
  );

export const storygraph: Command = {
  data: new SlashCommandBuilder()
    .setName("storygraph")
    .setDescription("For interacting with Storygraph")
    .addSubcommand(storygraphSearchSubcommand)
    .addSubcommand(storygraphLinkSubcommand)
    .addSubcommand(storygraphBookSubcommand)
    .addSubcommand(storygraphCoverSubcommand),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command storygraph`);
    }
  },
  cooldown: 3,
};
