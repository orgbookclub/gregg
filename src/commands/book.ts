import {
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { CommandHandler, Command } from "../models";
import { errorHandler } from "../utils/errorHandler";

import {
  handleAdd,
  handleCover,
  handleInfo,
  handleLink,
  handleSearch,
} from "./subcommands/book";

const handlers: Record<string, CommandHandler> = {
  search: handleSearch,
  info: handleInfo,
  cover: handleCover,
  link: handleLink,
  add: handleAdd,
};

const bookSearchSubcommand = new SlashCommandSubcommandBuilder()
  .setName("search")
  .setDescription("Fetches a list of book links from Open Library")
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
      .setName("ephemeral")
      .setDescription(
        "Whether the response should be ephemeral or not. Default is false",
      )
      .setRequired(false),
  );

const bookInfoSubcommand = new SlashCommandSubcommandBuilder()
  .setName("info")
  .setDescription("Fetches details of a book from Open Library")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephemeral")
      .setDescription(
        "Whether the response should be ephemeral or not. Default is false",
      )
      .setRequired(false),
  );

const bookCoverSubcommand = new SlashCommandSubcommandBuilder()
  .setName("cover")
  .setDescription("Fetches the cover of a book from Open Library")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephemeral")
      .setDescription(
        "Whether the response should be ephemeral or not. Default is false",
      )
      .setRequired(false),
  );

const bookLinkSubcommand = new SlashCommandSubcommandBuilder()
  .setName("link")
  .setDescription("Fetches a single book link from Open Library")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephemeral")
      .setDescription(
        "Whether the response should be ephemeral or not. Default is false",
      )
      .setRequired(false),
  );

const bookAddSubcommand = new SlashCommandSubcommandBuilder()
  .setName("add")
  .setDescription("Manually adds a book to the library (staff only)")
  .addStringOption((option) =>
    option
      .setName("title")
      .setDescription("The title of the book")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("authors")
      .setDescription("Comma-separated list of author names")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("OpenLibrary, Goodreads or Storygraph link to the book")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("cover")
      .setDescription("Link to the book cover image")
      .setRequired(false),
  )
  .addIntegerOption((option) =>
    option
      .setName("pages")
      .setDescription("The number of pages")
      .setRequired(false)
      .setMinValue(1),
  )
  .addStringOption((option) =>
    option
      .setName("genres")
      .setDescription("Comma-separated list of genres")
      .setRequired(false),
  );

export const book: Command = {
  data: new SlashCommandBuilder()
    .setName("book")
    .setDescription("For interacting with books")
    .addSubcommand(bookSearchSubcommand)
    .addSubcommand(bookInfoSubcommand)
    .addSubcommand(bookCoverSubcommand)
    .addSubcommand(bookLinkSubcommand)
    .addSubcommand(bookAddSubcommand)
    .setContexts(InteractionContextType.Guild),
  run: async (bot, interaction, guildConfig) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction, guildConfig);
    } catch (err) {
      await errorHandler(
        bot,
        "commands > book",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
  cooldown: 3,
};
