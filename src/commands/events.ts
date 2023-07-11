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
import { errorHandler } from "../utils/errorHandler";

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
  adduser: handleAddUser,
  removeuser: handleRemoveUser,
  stats: handleStats,
};

const eventsListSubcommand = new SlashCommandSubcommandBuilder()
  .setName("list")
  .setDescription("Fetches the list of events")
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
  .setDescription("Broadcasts a message to all the participants of an event")
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
  .setDescription("Fetches information for a single event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  );

const eventsRequestSubcommand = new SlashCommandSubcommandBuilder()
  .setName("request")
  .setDescription("Makes a request for a server reading event")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Event Type")
      .addChoices(...EventTypeOptions)
      .setRequired(true),
  );

const eventsEditSubcommand = new SlashCommandSubcommandBuilder()
  .setName("edit")
  .setDescription("Edits an event")
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
  .setDescription("Creates or updates a thread for an event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("A channel to create the thread in or a thread to update")
      .addChannelTypes(ChannelType.GuildForum | ChannelType.PublicThread),
  )
  .addStringOption((option) =>
    option
      .setName("title")
      .setDescription("The title for the thread")
      .setMinLength(2)
      .setMaxLength(100),
  );

const eventsAnnounceSubcommand = new SlashCommandSubcommandBuilder()
  .setName("announce")
  .setDescription("Makes an announcement for an approved event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to post the announcement in")
      .addChannelTypes(ChannelType.GuildAnnouncement),
  );

const eventsSearchSubcommand = new SlashCommandSubcommandBuilder()
  .setName("search")
  .setDescription("Fetches a list of events according to the query")
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
  .setDescription("Adds a user as participant to the event")
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
  .setDescription("Removes a user as participant from the event")
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
  .setDescription("Fetches the server event stats for a user")
  .addUserOption((option) =>
    option.setName("user").setDescription("User for which to fetch info"),
  );

export const events: Command = {
  data: new SlashCommandBuilder()
    .setName("events")
    .setDescription("Handles event-related features")
    .addSubcommand(eventsInfoSubcommand)
    .addSubcommand(eventsListSubcommand)
    .addSubcommand(eventsSearchSubcommand)
    .addSubcommand(eventsStatsSubcommand)
    .addSubcommand(eventsRequestSubcommand)
    .addSubcommand(eventsBroadcastSubcommand)
    .addSubcommand(eventsEditSubcommand)
    .addSubcommand(eventsCreateThreadSubcommand)
    .addSubcommand(eventsAnnounceSubcommand)
    .addSubcommand(eventsAddUserSubcommand)
    .addSubcommand(eventsRemoveUserSubcommand)
    .setDMPermission(false),
  run: async (bot, interaction) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction);
    } catch (err) {
      await errorHandler(
        bot,
        "commands > events",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
};
