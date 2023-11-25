import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import { CommandHandler, Command } from "../models";
import { errorHandler } from "../utils/errorHandler";

import { handleGet, handleSetReaderRole } from "./subcommands/config";

const handlers: Record<string, CommandHandler> = {
  setreaderrole: handleSetReaderRole,
  get: handleGet,
};

const setReaderRole = new SlashCommandSubcommandBuilder()
  .setName("setreaderrole")
  .setDescription("Sets a role as a reader role")
  .addRoleOption((option) =>
    option.setName("role").setDescription("The role").setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("points")
      .setDescription("The minimum required points for the role")
      .setRequired(true),
  );

const get = new SlashCommandSubcommandBuilder()
  .setName("get")
  .setDescription("Gets the current guild config");

export const config: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("For guild config management")
    .addSubcommand(setReaderRole)
    .addSubcommand(get)
    .setDMPermission(false),
  run: async (bot, interaction, guildConfig) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction, guildConfig);
    } catch (err) {
      await errorHandler(
        bot,
        "commands > config",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
};
