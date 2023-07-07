import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import { CommandHandler, Command } from "../models";
import { logger } from "../utils/logHandler";

import { handlePing, handleAbout } from "./subcommands/gregg";

const handlers: Record<string, CommandHandler> = {
  ping: handlePing,
  about: handleAbout,
};

const greggPingSubcommand = new SlashCommandSubcommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

const greggInfoSubcommand = new SlashCommandSubcommandBuilder()
  .setName("about")
  .setDescription("Shows information about the bot");

export const gregg: Command = {
  data: new SlashCommandBuilder()
    .setName("gregg")
    .setDescription("For general commands")
    .addSubcommand(greggPingSubcommand)
    .addSubcommand(greggInfoSubcommand),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command gregg`);
    }
  },
};
