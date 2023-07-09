import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import { CommandHandler, Command } from "../models";
import { errorHandler } from "../utils/errorHandler";

import {
  handleBook,
  handleCover,
  handleLink,
  handleQuote,
  handleSearch,
} from "./subcommands/goodreads";

const handlers: Record<string, CommandHandler> = {
  search: handleSearch,
  book: handleBook,
  cover: handleCover,
  link: handleLink,
  quote: handleQuote,
};

const goodreadsSearchSubcommand = new SlashCommandSubcommandBuilder()
  .setName("search")
  .setDescription("Fetches a list of book links from GR")
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

const goodreadsLinkSubcommand = new SlashCommandSubcommandBuilder()
  .setName("link")
  .setDescription("Fetches a single book link from GR")
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

const goodreadsBookSubcommand = new SlashCommandSubcommandBuilder()
  .setName("book")
  .setDescription("Fetches details of a book from GR")
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

const goodreadsCoverSubcommand = new SlashCommandSubcommandBuilder()
  .setName("cover")
  .setDescription("Fetches cover of a book from GR")
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

const goodreadsQuoteSubcommand = new SlashCommandSubcommandBuilder()
  .setName("quote")
  .setDescription("Fetches a random quote from GR")
  .addStringOption((option) =>
    option.setName("query").setDescription("Book title, author or ISBN"),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephermal")
      .setDescription(
        "Whether the response should be ephermal or not. Default is true",
      )
      .setRequired(false),
  );

export const goodreads: Command = {
  data: new SlashCommandBuilder()
    .setName("goodreads")
    .setDescription("For interacting with Goodreads")
    .addSubcommand(goodreadsSearchSubcommand)
    .addSubcommand(goodreadsLinkSubcommand)
    .addSubcommand(goodreadsBookSubcommand)
    .addSubcommand(goodreadsCoverSubcommand)
    .addSubcommand(goodreadsQuoteSubcommand)
    .setDMPermission(false),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      await errorHandler(
        bot,
        "commands > goodreads",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
  cooldown: 3,
};
