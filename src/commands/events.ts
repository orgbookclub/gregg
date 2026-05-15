import {
  ChannelType,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";

import {
  EventFieldOptions,
  EventStatusOptions,
  EventTypeOptions,
} from "../config";
import { EventSortOptions } from "../config/EventSortOptions";
import { Command, CommandHandler } from "../models";
import { addDateWindowOptions } from "../utils/dateWindow";
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
  handleServerStats,
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
  serverstats: handleServerStats,
};

const list = new SlashCommandSubcommandBuilder()
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
  )
  .addStringOption((option) =>
    option
      .setName("sort")
      .setDescription("Sort by")
      .addChoices(...EventSortOptions)
      .setRequired(false),
  );

const broadcast = new SlashCommandSubcommandBuilder()
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

const info = new SlashCommandSubcommandBuilder()
  .setName("info")
  .setDescription("Fetches information for a single event")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  );

const request = new SlashCommandSubcommandBuilder()
  .setName("request")
  .setDescription("Makes a request for a server reading event")
  .addStringOption((option) =>
    option
      .setName("type")
      .setDescription("Event Type")
      .addChoices(...EventTypeOptions)
      .setRequired(true),
  );

const edit = new SlashCommandSubcommandBuilder()
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

const createThread = new SlashCommandSubcommandBuilder()
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

const announce = new SlashCommandSubcommandBuilder()
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

const search = new SlashCommandSubcommandBuilder()
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

const addUser = new SlashCommandSubcommandBuilder()
  .setName("adduser")
  .setDescription("Opens a form to add up to 25 users as participants")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  );

const removeUser = new SlashCommandSubcommandBuilder()
  .setName("removeuser")
  .setDescription("Opens a form to remove up to 25 users as participants")
  .addStringOption((option) =>
    option.setName("id").setDescription("Event ID").setRequired(true),
  );

const stats = addDateWindowOptions(
  new SlashCommandSubcommandBuilder()
    .setName("stats")
    .setDescription("Fetches the server event stats for a user")
    .addUserOption((option) =>
      option.setName("user").setDescription("User for which to fetch info"),
    ),
);

const serverStats = addDateWindowOptions(
  new SlashCommandSubcommandBuilder()
    .setName("serverstats")
    .setDescription("Shows guild-wide event stats for the configured window"),
);

export const events: Command = {
  data: new SlashCommandBuilder()
    .setName("events")
    .setDescription("Handles event-related features")
    .addSubcommand(info)
    .addSubcommand(list)
    .addSubcommand(search)
    .addSubcommand(stats)
    .addSubcommand(serverStats)
    .addSubcommand(request)
    .addSubcommand(broadcast)
    .addSubcommand(edit)
    .addSubcommand(createThread)
    .addSubcommand(announce)
    .addSubcommand(addUser)
    .addSubcommand(removeUser)
    .setContexts(InteractionContextType.Guild),
  run: async (bot, interaction, guildConfig) => {
    try {
      const subCommand = interaction.options.getSubcommand();
      const handler = handlers[subCommand];
      await handler(bot, interaction, guildConfig);
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
