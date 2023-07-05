import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Bot, Command, CommandHandler } from "../models";
import { logger } from "../utils/logHandler";

import { handleList, handlePost, handleSuggest } from "./subcommands/qotd";

const handlers: Record<string, CommandHandler> = {
  suggest: handleSuggest,
  list: handleList,
  post: handlePost,
};

const qotdSuggestSubcommand = new SlashCommandSubcommandBuilder()
  .setName("suggest")
  .setDescription("Suggest a QOTD")
  .addStringOption((option) =>
    option
      .setName("question")
      .setDescription("Your suggested question of the day.")
      .setRequired(true),
  );

const qotdListSubcommand = new SlashCommandSubcommandBuilder()
  .setName("list")
  .setDescription("Lists the available QOTDs");

const qotdPostSubcommand = new SlashCommandSubcommandBuilder()
  .setName("post")
  .setDescription("Posts a QOTD thread in the channel.")
  .addStringOption((option) =>
    option.setName("id").setDescription("ID of the QOTD").setRequired(false),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Channel where QOTD will be posted.")
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText),
  );

export const qotd: Command = {
  data: new SlashCommandBuilder()
    .setName("qotd")
    .setDescription("Handles QOTD commands")
    .addSubcommand(qotdSuggestSubcommand)
    .addSubcommand(qotdListSubcommand)
    .addSubcommand(qotdPostSubcommand)
    .setDMPermission(false),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command qotd`);
    }
  },
};
