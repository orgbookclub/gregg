import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

const handlers: { [key: string]: CommandHandler } = {};
export const storygraph: Command = {
  data: new SlashCommandBuilder()
    .setName("storygraph")
    .setDescription("Handles SG related commands")
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
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
        ),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("link")
        .setDescription("Fetches the link of a book from SG")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Book title, author or ISBN")
            .setRequired(true),
        ),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("book")
        .setDescription("Fetches the details of a book from SG")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Book title, author or ISBN")
            .setRequired(true),
        ),
    )
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("cover")
        .setDescription("Fetches the cover of a book from SG")
        .addStringOption((option) =>
          option
            .setName("query")
            .setDescription("Book title, author or ISBN")
            .setRequired(true),
        ),
    ),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(`Error processing command storygraph ${err}`);
    }
  },
};
