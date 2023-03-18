import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import { EventFieldOptions } from "../config/EventFieldOptions";
import { EventStatusOptions } from "../config/EventStatusOptions";
import { EventTypeOptions } from "../config/EventTypeOptions";
import { Bot } from "../interfaces/Bot";
import { Command } from "../interfaces/Command";
import { CommandHandler } from "../interfaces/CommandHandler";
import { logger } from "../utils/logHandler";

import { handleApprove } from "./subcommands/events/approve";
import { handleBroadcast } from "./subcommands/events/broadcast";
import { handleEdit } from "./subcommands/events/edit";
import { handleInfo } from "./subcommands/events/info";
import { handleList } from "./subcommands/events/list";
import { handleRequest } from "./subcommands/events/request";
import { handleSearch } from "./subcommands/events/search";

const handlers: { [key: string]: CommandHandler } = {
  list: handleList,
  info: handleInfo,
  search: handleSearch,
  request: handleRequest,
  edit: handleEdit,
  approve: handleApprove,
  broadcast: handleBroadcast,
};
const eventsListSubcommand = new SlashCommandSubcommandBuilder()
  .setName("list")
  .setDescription("Shows a list of events")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Event Type")
      .addChoices(...EventTypeOptions)
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("status")
      .setDescription("Event Status")
      .addChoices(...EventStatusOptions)
      .setRequired(true),
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
const eventsApproveSubcommand = new SlashCommandSubcommandBuilder()
  .setName("approve")
  .setDescription("announces an event");
const eventsEditSubcommand = new SlashCommandSubcommandBuilder()
  .setName("edit")
  .setDescription("edit an event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("field")
      .setDescription("The field which you want to edit")
      .addChoices(...EventFieldOptions),
  );
const eventsSearchSubcommand = new SlashCommandSubcommandBuilder()
  .setName("search")
  .setDescription("searches for events")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("The query string")
      .setRequired(true),
  )
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
export const events: Command = {
  data: new SlashCommandBuilder()
    .setName("events")
    .setDescription("Handles event-related features")
    .addSubcommand(eventsRequestSubcommand)
    .addSubcommand(eventsListSubcommand)
    .addSubcommand(eventsBroadcastSubcommand)
    .addSubcommand(eventsInfoSubcommand)
    .addSubcommand(eventsApproveSubcommand)
    .addSubcommand(eventsEditSubcommand)
    .addSubcommand(eventsSearchSubcommand),
  run: async (bot: Bot, interaction: ChatInputCommandInteraction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(`Error processing command events ${err}`);
    }
  },
};
