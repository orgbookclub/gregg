import {
  ChannelType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { CommandHandler, Command } from "../models";
import { errorHandler } from "../utils/errorHandler";

import { handlePing, handleAbout } from "./subcommands/gregg";
import { handleEcho } from "./subcommands/gregg/echo";

const handlers: Record<string, CommandHandler> = {
  ping: handlePing,
  about: handleAbout,
  echo: handleEcho,
};

const greggPingSubcommand = new SlashCommandSubcommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

const greggInfoSubcommand = new SlashCommandSubcommandBuilder()
  .setName("about")
  .setDescription("Shows information about the bot");

const greggEchoSubcommand = new SlashCommandSubcommandBuilder()
  .setName("echo")
  .setDescription("Sends the input message as the bot")
  .addStringOption((option) =>
    option
      .setName("message")
      .setDescription("The message to send")
      .setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to send the message in")
      .addChannelTypes(ChannelType.GuildText),
  );
export const gregg: Command = {
  data: new SlashCommandBuilder()
    .setName("gregg")
    .setDescription("For general commands")
    .addSubcommand(greggPingSubcommand)
    .addSubcommand(greggInfoSubcommand)
    .addSubcommand(greggEchoSubcommand)
    .setDMPermission(false),
  run: async (bot, interaction, guildConfig) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction, guildConfig);
    } catch (err) {
      await errorHandler(
        bot,
        "commands > gregg",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
};
