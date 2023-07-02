import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { CommandHandler, Command, Bot } from "../models";
import { logger } from "../utils/logHandler";

import {
  handleStart,
  handleJoin,
  handleLeave,
  handleCancel,
  handleStatus,
  handleFinish,
} from "./subcommands/sprint";

const handlers: Record<string, CommandHandler> = {
  start: handleStart,
  join: handleJoin,
  leave: handleLeave,
  cancel: handleCancel,
  status: handleStatus,
  finish: handleFinish,
  // TODO: Handle sprint stats command
};

// TODO: Handle cooldown for this command
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
  .setDescription("Join the ongoing sprint")
  .addIntegerOption((option) =>
    option.setName("count").setDescription("The initial count"),
  );
const sprintFinishSubcommand = new SlashCommandSubcommandBuilder()
  .setName("finish")
  .setDescription("Gives your final count to the bot at the end of a sprint.")
  .addIntegerOption((option) =>
    option.setName("count").setDescription("The final count"),
  );
const sprintStatsSubcommand = new SlashCommandSubcommandBuilder()
  .setName("stats")
  .setDescription("Shows the total sprint stats of a user")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("User for which stats should be shown"),
  );
const sprintStatusSubcommand = new SlashCommandSubcommandBuilder()
  .setName("status")
  .setDescription("Shows the current status of the ongoing sprint");
const sprintCancelSubcommand = new SlashCommandSubcommandBuilder()
  .setName("cancel")
  .setDescription("Cancels an ongoing sprint in the channel");
const sprintLeaveSubcommand = new SlashCommandSubcommandBuilder()
  .setName("leave")
  .setDescription("Leave an ongoing sprint in the channel");

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
    .addSubcommand(sprintLeaveSubcommand),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command sprint`);
    }
  },
};
