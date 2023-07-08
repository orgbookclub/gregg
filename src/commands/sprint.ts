import { SlashCommandBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import { CommandHandler, Command } from "../models";
import { errorHandler } from "../utils/errorHandler";

import {
  handleStart,
  handleJoin,
  handleLeave,
  handleCancel,
  handleStatus,
  handleFinish,
  handleStats,
} from "./subcommands/sprint";

const handlers: Record<string, CommandHandler> = {
  start: handleStart,
  join: handleJoin,
  leave: handleLeave,
  cancel: handleCancel,
  status: handleStatus,
  finish: handleFinish,
  stats: handleStats,
};

const sprintStartSubcommand = new SlashCommandSubcommandBuilder()
  .setName("start")
  .setDescription("Starts a reading sprint")
  .addIntegerOption((option) =>
    option
      .setName("duration")
      .setDescription("The duration of the sprint in minutes")
      .setMinValue(1)
      .setMaxValue(60)
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("delay")
      .setDescription("Minutes to delay before the sprint starts")
      .setMinValue(0)
      .setMaxValue(15),
  );

const sprintJoinSubcommand = new SlashCommandSubcommandBuilder()
  .setName("join")
  .setDescription("Adds the user as a participant of the ongoing sprint")
  .addIntegerOption((option) =>
    option.setName("count").setDescription("The initial count"),
  );

const sprintFinishSubcommand = new SlashCommandSubcommandBuilder()
  .setName("finish")
  .setDescription("Logs the final count for a user at the end of a sprint")
  .addIntegerOption((option) =>
    option.setName("count").setDescription("The final count"),
  );

const sprintStatsSubcommand = new SlashCommandSubcommandBuilder()
  .setName("stats")
  .setDescription("Fetches total sprint stats of a user")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("User for which stats should be shown"),
  );

const sprintStatusSubcommand = new SlashCommandSubcommandBuilder()
  .setName("status")
  .setDescription("Fetches the status of the ongoing sprint");

const sprintCancelSubcommand = new SlashCommandSubcommandBuilder()
  .setName("cancel")
  .setDescription("Cancels an ongoing sprint");

const sprintLeaveSubcommand = new SlashCommandSubcommandBuilder()
  .setName("leave")
  .setDescription("Removes a user from the ongoing sprint");

export const sprint: Command = {
  data: new SlashCommandBuilder()
    .setName("sprint")
    .setDescription("Handles sprint related commands")
    .addSubcommand(sprintStartSubcommand)
    .addSubcommand(sprintJoinSubcommand)
    .addSubcommand(sprintFinishSubcommand)
    .addSubcommand(sprintStatsSubcommand)
    .addSubcommand(sprintStatusSubcommand)
    .addSubcommand(sprintCancelSubcommand)
    .addSubcommand(sprintLeaveSubcommand)
    .setDMPermission(false),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      errorHandler(
        bot,
        "commands > sprint",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
  cooldown: 3,
};
