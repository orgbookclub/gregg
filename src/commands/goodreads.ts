import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

import { handleBook } from "./subcommands/goodreads/book";
import { handleCover } from "./subcommands/goodreads/cover";
import { handleLink } from "./subcommands/goodreads/link";
import { handleQuote } from "./subcommands/goodreads/quote";
import { handleSearch } from "./subcommands/goodreads/search";

const handlers: { [key: string]: CommandHandler } = {
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
      .setName("k")
      .setDescription("Maximum number of results to fetch")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(7),
  );
const goodreadsLinkSubcommand = new SlashCommandSubcommandBuilder()
  .setName("link")
  .setDescription("Fetches the link of a book from GR")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  );
const goodreadsBookSubcommand = new SlashCommandSubcommandBuilder()
  .setName("book")
  .setDescription("Fetches the details of a book from GR")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  );
const goodreadsCoverSubcommand = new SlashCommandSubcommandBuilder()
  .setName("cover")
  .setDescription("Fetches the cover of a book from GR")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  );
const goodreadsQuoteSubcommand = new SlashCommandSubcommandBuilder()
  .setName("quote")
  .setDescription("Fetches a random quote from GR")
  .addStringOption((option) =>
    option.setName("query").setDescription("Book title, author or ISBN"),
  );
export const goodreads: Command = {
  data: new SlashCommandBuilder()
    .setName("goodreads")
    .setDescription("Handles GR related commands")
    .addSubcommand(goodreadsSearchSubcommand)
    .addSubcommand(goodreadsLinkSubcommand)
    .addSubcommand(goodreadsBookSubcommand)
    .addSubcommand(goodreadsCoverSubcommand)
    .addSubcommand(goodreadsQuoteSubcommand),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(`Error processing command goodreads ${err}`);
    }
  },
};
