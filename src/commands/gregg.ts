import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { CommandHandler, Command, Bot } from "../models";
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
  .setDescription("Shows information about Gregg.");

export const gregg: Command = {
  data: new SlashCommandBuilder()
    .setName("gregg")
    .setDescription("Handles general commands about the bot")
    .addSubcommand(greggPingSubcommand)
    .addSubcommand(greggInfoSubcommand),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command gregg`);
    }
  },
};
