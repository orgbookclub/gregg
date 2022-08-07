import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

const handlers: { [key: string]: CommandHandler } = {};
const sprintStartSubcommand = new SlashCommandSubcommandBuilder()
  .setName("start")
  .setDescription("Starts a reading sprint")
  .addIntegerOption((option) =>
    option
      .setName("duration")
      .setDescription("The duration of the sprint in minutes")
      .setMinValue(1)
      .setMaxValue(60),
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
    option.setName("k").setDescription("The initial count"),
  );
const sprintCountSubcommand = new SlashCommandSubcommandBuilder()
  .setName("count")
  .setDescription("Gives your final count to the bot at the end of a sprint.")
  .addIntegerOption((option) =>
    option.setName("k").setDescription("The final count"),
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
    .addSubcommand(sprintCountSubcommand)
    .addSubcommand(sprintStatsSubcommand)
    .addSubcommand(sprintStatusSubcommand)
    .addSubcommand(sprintCancelSubcommand)
    .addSubcommand(sprintLeaveSubcommand),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(`Error processing command sprint ${err}`);
    }
  },
};
