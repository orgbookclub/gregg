import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { EventStatusOptions } from "../config/EventStatusOptions";
import { EventTypeOptions } from "../config/EventTypeOptions";
import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

import { handleList } from "./subcommands/events/list";

const handlers: { [key: string]: CommandHandler } = {
  list: handleList,
};
const eventsListSubcommand = new SlashCommandSubcommandBuilder()
  .setName("list")
  .setDescription("Shows a list of events")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Event Type")
      .addChoices(...EventTypeOptions),
  )
  .addStringOption((option) =>
    option
      .setName("status")
      .setDescription("Event Status")
      .addChoices(...EventStatusOptions),
  );
const eventsBroadcastSubcommand = new SlashCommandSubcommandBuilder()
  .setName("broadcast")
  .setDescription("Notifies all the participants of an event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  );
const eventsInfoSubcommand = new SlashCommandSubcommandBuilder()
  .setName("info")
  .setDescription("Shows detailed information for an event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  );
const eventsRequestSubcommand = new SlashCommandSubcommandBuilder()
  .setName("request")
  .setDescription("Request a server reading event")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Event Type")
      .addChoices(...EventTypeOptions)
      .setRequired(true),
  );
// TODO: Replace with actual commands
const eventsAnnounceSubcommand = new SlashCommandSubcommandBuilder()
  .setName("announce")
  .setDescription("announces an event");
const eventsEditSubcommand = new SlashCommandSubcommandBuilder()
  .setName("edit")
  .setDescription("edit an event");
const eventsSearchSubcommand = new SlashCommandSubcommandBuilder()
  .setName("search")
  .setDescription("searches for events");
const eventsPollSubcommand = new SlashCommandSubcommandBuilder()
  .setName("poll")
  .setDescription("creates a poll");
export const events: Command = {
  data: new SlashCommandBuilder()
    .setName("events")
    .setDescription("Handles event-related features")
    .addSubcommand(eventsRequestSubcommand)
    .addSubcommand(eventsListSubcommand)
    .addSubcommand(eventsBroadcastSubcommand)
    .addSubcommand(eventsInfoSubcommand)
    .addSubcommand(eventsAnnounceSubcommand)
    .addSubcommand(eventsEditSubcommand)
    .addSubcommand(eventsSearchSubcommand)
    .addSubcommand(eventsPollSubcommand),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      await interaction.deferReply();
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(`Error processing command events ${err}`);
    }
  },
};
