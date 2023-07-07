import {
  ChannelType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import {
  EventFieldOptions,
  EventStatusOptions,
  EventTypeOptions,
} from "../config";
import { EventParticipantOptions } from "../config/EventParticipantOptions";
import { Command, CommandHandler } from "../models";
import { logger } from "../utils/logHandler";

import {
  handleAddUser,
  handleAnnounce,
  handleBroadcast,
  handleCreateThread,
  handleEdit,
  handleInfo,
  handleList,
  handleRemoveUser,
  handleRequest,
  handleSearch,
  handleStats,
} from "./subcommands/events";

const handlers: Record<string, CommandHandler> = {
  list: handleList,
  info: handleInfo,
  search: handleSearch,
  request: handleRequest,
  edit: handleEdit,
  announce: handleAnnounce,
  createthread: handleCreateThread,
  broadcast: handleBroadcast,
  addUser: handleAddUser,
  removeUser: handleRemoveUser,
  stats: handleStats,
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
  .setDescription("Broadcasts a message to all the readers of an event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .addChannelTypes(ChannelType.GuildText)
      .setDescription("The channel to post the broadcast message in"),
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

const eventsEditSubcommand = new SlashCommandSubcommandBuilder()
  .setName("edit")
  .setDescription("edit an event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("field")
      .setDescription("The field which will be edited")
      .addChoices(...EventFieldOptions)
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("value")
      .setDescription("The value which will be set in the field")
      .setRequired(true),
  );

const eventsCreateThreadSubcommand = new SlashCommandSubcommandBuilder()
  .setName("createthread")
  .setDescription("creates a forum post for an approved event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("thread")
      .setDescription("The thread if it already exists")
      .addChannelTypes(ChannelType.PublicThread),
  )
  .addStringOption((option) =>
    option
      .setName("title")
      .setDescription("The title for the forum post")
      .setMinLength(2)
      .setMaxLength(100),
  );

const eventsAnnounceSubcommand = new SlashCommandSubcommandBuilder()
  .setName("announce")
  .setDescription("makes an announcement for an approved event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
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

const eventsAddUserSubcommand = new SlashCommandSubcommandBuilder()
  .setName("adduser")
  .setDescription("Adds a participant to the event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user to add as a participant")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("The type of participant to add the user as")
      .addChoices(...EventParticipantOptions)
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("points")
      .setDescription("The number of points to assign. Defaults to 5")
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100),
  );

const eventsRemoveUserSubcommand = new SlashCommandSubcommandBuilder()
  .setName("removeuser")
  .setDescription("Removes a participant from the event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user to remove as a participant")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("The type of participant")
      .addChoices(...EventParticipantOptions)
      .setRequired(true),
  );

const eventsStatsSubcommand = new SlashCommandSubcommandBuilder()
  .setName("stats")
  .setDescription("Gets the server event stats for a user")
  .addUserOption((option) =>
    option.setName("user").setDescription("User for which to fetch info"),
  );

export const events: Command = {
  data: new SlashCommandBuilder()
    .setName("events")
    .setDescription("Handles event-related features")
    .addSubcommand(eventsListSubcommand)
    .addSubcommand(eventsRequestSubcommand)
    .addSubcommand(eventsBroadcastSubcommand)
    .addSubcommand(eventsInfoSubcommand)
    .addSubcommand(eventsCreateThreadSubcommand)
    .addSubcommand(eventsAnnounceSubcommand)
    .addSubcommand(eventsEditSubcommand)
    .addSubcommand(eventsSearchSubcommand)
    .addSubcommand(eventsAddUserSubcommand)
    .addSubcommand(eventsRemoveUserSubcommand)
    .addSubcommand(eventsStatsSubcommand)
    .setDMPermission(false),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      logger.error(err, `Error processing command events`);
    }
  },
};
