import {
  ChannelType,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from "discord.js";

import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

const handlers: { [key: string]: CommandHandler } = {};

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

const miscQotdSubcommandGroup = new SlashCommandSubcommandGroupBuilder()
  .setName("qotd")
  .setDescription("Handles QOTD commands")
  .addSubcommand(qotdSuggestSubcommand)
  .addSubcommand(qotdPostSubcommand)
  .addSubcommand(qotdListSubcommand)
  .addSubcommand(qotdApproveSubcommand)
  .addSubcommand(qotdRejectSubcommand);

export const misc: Command = {
  data: new SlashCommandBuilder()
    .setName("misc")
    .setDescription("Handles misc commands")
    .addSubcommandGroup(miscQotdSubcommandGroup),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(`Error processing command misc ${err}`);
    }
  },
};
