import {
  ChannelType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Command, CommandHandler } from "../models";
import { errorHandler } from "../utils/errorHandler";

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
      .setDescription("The question to suggest")
      .setRequired(true),
  );

const qotdListSubcommand = new SlashCommandSubcommandBuilder()
  .setName("list")
  .setDescription("Lists the available QOTDs");

const qotdPostSubcommand = new SlashCommandSubcommandBuilder()
  .setName("post")
  .setDescription("Posts a QOTD thread in the channel")
  .addStringOption((option) =>
    option.setName("id").setDescription("Id of the QOTD"),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Channel where QOTD will be posted.")
      .addChannelTypes(ChannelType.GuildText),
  );

export const qotd: Command = {
  data: new SlashCommandBuilder()
    .setName("qotd")
    .setDescription("For handling QOTD related commands")
    .addSubcommand(qotdSuggestSubcommand)
    .addSubcommand(qotdListSubcommand)
    .addSubcommand(qotdPostSubcommand)
    .setDMPermission(false),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      errorHandler(
        bot,
        "commands > qotd",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
  cooldown: 3,
};
