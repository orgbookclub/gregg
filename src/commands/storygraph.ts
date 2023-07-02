import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { CommandHandler, Command, Bot } from "../models";
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
      .setName("k")
      .setDescription("Maximum number of results to fetch")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(7),
  );
const storygraphLinkSubcommand = new SlashCommandSubcommandBuilder()
  .setName("link")
  .setDescription("Fetches the link of a book from SG")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  );
const storygraphBookSubcommand = new SlashCommandSubcommandBuilder()
  .setName("book")
  .setDescription("Fetches the details of a book from SG")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  );
const storygraphCoverSubcommand = new SlashCommandSubcommandBuilder()
  .setName("cover")
  .setDescription("Fetches the cover of a book from SG")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Book title, author or ISBN")
      .setRequired(true),
  );
export const storygraph: Command = {
  data: new SlashCommandBuilder()
    .setName("storygraph")
    .setDescription("Handles SG related commands")
    .addSubcommand(storygraphSearchSubcommand)
    .addSubcommand(storygraphLinkSubcommand)
    .addSubcommand(storygraphBookSubcommand)
    .addSubcommand(storygraphCoverSubcommand),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command storygraph`);
    }
  },
};
