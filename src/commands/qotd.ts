import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Bot, Command, CommandHandler } from "../models";
import { logger } from "../utils/logHandler";

import { handleSuggest } from "./subcommands/qotd/suggest";

const handlers: Record<string, CommandHandler> = {
  suggest: handleSuggest,
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

const qotdListSubcommand = new SlashCommandSubcommandBuilder()
  .setName("list")
  .setDescription("Lists the available QOTDs");

const qotdApproveSubcommand = new SlashCommandSubcommandBuilder()
  .setName("approve")
  .setDescription("Approve a suggested QOTD")
  .addStringOption((option) =>
    option.setName("id").setDescription("ID of the QOTD").setRequired(true),
  );

const qotdRejectSubcommand = new SlashCommandSubcommandBuilder()
  .setName("reject")
  .setDescription("Reject a suggested QOTD")
  .addStringOption((option) =>
    option.setName("id").setDescription("ID of the QOTD").setRequired(true),
  );

export const qotd: Command = {
  data: new SlashCommandBuilder()
    .setName("qotd")
    .setDescription("Handles QOTD commands")
    .addSubcommand(qotdSuggestSubcommand)
    .addSubcommand(qotdPostSubcommand)
    .addSubcommand(qotdListSubcommand)
    .addSubcommand(qotdApproveSubcommand)
    .addSubcommand(qotdRejectSubcommand),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command qotd`);
    }
  },
};
