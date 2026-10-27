import { GuildsConfig } from "@prisma/client";
import {
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  DiscordjsError,
  ForumChannel,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { errors, placeholders, templates } from "../../../config/constants";
import { Bot, CommandHandler } from "../../../models";
import {
  formatWindowTitle,
  resolveDateWindow,
} from "../../../utils/dateWindow";
import { createEventMessageDoc } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import { logger } from "../../../utils/logHandler";
import { PaginationManager } from "../../../utils/paginationManager";
import {
  configuredForum,
  createEngineForumThread,
  postEngineAnnouncement,
  withAnnouncementLock,
} from "../announcements";
import { parseBookReference } from "../books";
import { EngineInstallationClient } from "../client";
import {
  buildEngineEventEmbed,
  buildEngineParticipationRow,
  buildEngineStaffRow,
} from "../embeds";
import { discordThreadLink, withDiscordLink } from "../links";
import {
  engineTypeKey,
  nextMonthRange,
  toEngineStatsWindow,
} from "../mappings";
import { toCalendarDateInput } from "../staffActions";
import { EngineEventDetail, EngineLeaderboardEntry } from "../types";

import { engineCommand, engineErrorMessage, interactionActor } from "./common";
import { engineListHandlers, engineUserExtraHandlers } from "./lists";
import { engineStaffHandlers } from "./staff";
import {
  buildEngineLeaderboardContainer,
  buildEngineMemberStatsContainer,
  buildEngineOverviewContainer,
  fetchMemberStats,
} from "./stats";

const REQUEST_MODAL_ID = "engineEventRequestModal";
const BOOK_FIELD_ID = "book";
const START_FIELD_ID = "startDate";
const END_FIELD_ID = "endDate";
const REASON_FIELD_ID = "reason";
const MODAL_TIMEOUT_MS = 5 * 60 * 1000;
const BOOK_PLACEHOLDER = "https://www.goodreads.com/book/show/5907";
const THREAD_STATUSES = ["approved", "announced", "ongoing"];
const LEADERBOARD_PAGE_SIZE = 100;
const LEADERBOARD_MAX_PAGES = 5;

function buildRequestModal(
  customId: string,
  typeLabel: string,
  withDates: boolean,
  prefill?: string,
) {
  const bookInput = new TextInputBuilder()
    .setCustomId(BOOK_FIELD_ID)
    .setRequired(true)
    .setPlaceholder(BOOK_PLACEHOLDER)
    .setStyle(TextInputStyle.Short);
  if (prefill) bookInput.setValue(prefill);
  const labelsList: LabelBuilder[] = [
    new LabelBuilder()
      .setLabel("Book (book page URL, ISBN or book ID)")
      .setTextInputComponent(bookInput),
  ];
  if (withDates) {
    for (const [id, label] of [
      [START_FIELD_ID, placeholders.EventStartPrompt],
      [END_FIELD_ID, placeholders.EventEndPrompt],
    ]) {
      labelsList.push(
        new LabelBuilder()
          .setLabel(label)
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId(id)
              .setRequired(true)
              .setPlaceholder(placeholders.DatePlaceholder)
              .setStyle(TextInputStyle.Short)
              .setMinLength(10)
              .setMaxLength(10),
          ),
      );
    }
  }
  labelsList.push(
    new LabelBuilder()
      .setLabel(placeholders.RequestReasonPrompt)
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId(REASON_FIELD_ID)
          .setRequired(true)
          .setMaxLength(4000)
          .setPlaceholder(placeholders.RequestReasonExample)
          .setStyle(TextInputStyle.Paragraph),
      ),
  );
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(`${typeLabel} Request`.slice(0, 45))
    .addLabelComponents(...labelsList);
}

async function postRequestMessage(
  bot: Bot,
  client: EngineInstallationClient,
  submit: ModalSubmitInteraction,
  event: EngineEventDetail,
  guildConfig: GuildsConfig | undefined,
) {
  if (event.type.key !== "buddy-read" || !guildConfig?.brRequestChannel) return;
  const channel = await bot.channels
    .fetch(guildConfig.brRequestChannel)
    .catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return;
  const participants = await client.listParticipants(event.id);
  const message = await (channel as TextChannel).send({
    embeds: [
      buildEngineEventEmbed(
        event,
        participants,
        "request",
        submit.guild?.iconURL(),
      ),
    ],
    components: [buildEngineParticipationRow(event.id, "er")],
  });
  await createEventMessageDoc(
    bot,
    client.guildId,
    event.id,
    message,
    "BRRequest",
  );
}

const handleRequest = engineCommand(
  "events > request (engine)",
  async (bot, interaction, client, guildConfig) => {
    await runEngineRequestFlow(
      bot,
      interaction,
      client,
      guildConfig,
      interaction.options.getString("type", true),
    );
  },
);

const handleInfo = engineCommand(
  "events > info (engine)",
  async (_bot, interaction, client) => {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const event = await client.getEvent(id, interactionActor(interaction));
    const participants = await client.listParticipants(id);
    const staffRow = buildEngineStaffRow(event);
    await interaction.editReply({
      embeds: [
        buildEngineEventEmbed(
          event,
          participants,
          "info",
          interaction.guild?.iconURL(),
        ),
      ],
      components: staffRow ? [staffRow] : [],
    });
  },
);

const handleCreateThread = engineCommand(
  "events > createThread (engine)",
  async (bot, interaction, client, guildConfig) => {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const channel = interaction.options.getChannel<
      ChannelType.GuildForum | ChannelType.PublicThread
    >("channel");
    const title = interaction.options.getString("title");
    const event = await client.getEvent(id, interactionActor(interaction));
    if (!event.permissions.canSetLinks) {
      await interaction.editReply(errors.StaffRestrictionError);
      return;
    }
    if (!THREAD_STATUSES.includes(event.status)) {
      await interaction.editReply(
        "Threads can only be created for approved, announced or ongoing events.",
      );
      return;
    }
    if (channel && channel.type === ChannelType.PublicThread) {
      const participants = await client.listParticipants(id);
      await channel.send({
        embeds: [
          buildEngineEventEmbed(
            event,
            participants,
            "info",
            interaction.guild?.iconURL(),
          ),
        ],
      });
      if (title) await channel.edit({ name: title });
      await client.putLinks(
        event.id,
        withDiscordLink(
          event.externalLinks,
          discordThreadLink(client.guildId, {
            id: channel.id,
            name: title ?? channel.name,
          }),
        ),
      );
      await interaction.editReply(
        templates.threadCreated(channel.id, event.id),
      );
      return;
    }
    const forum =
      (channel as ForumChannel | null) ??
      (await configuredForum(bot, event.type.key, guildConfig));
    if (!forum) {
      await interaction.editReply(
        "Unable to find a configured/inputted forum channel!",
      );
      return;
    }
    const threadId = await createEngineForumThread(
      bot,
      client,
      event,
      forum,
      title,
    );
    await interaction.editReply(templates.threadCreated(threadId, event.id));
  },
);

const handleAnnounce = engineCommand(
  "events > announce (engine)",
  async (bot, interaction, client, guildConfig) => {
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const actor = interactionActor(interaction);
    const current = await client.getEvent(id, actor);
    if (!current.allowedTransitions.includes("announced")) {
      await interaction.editReply(
        current.status === "approved"
          ? errors.StaffRestrictionError
          : templates.mustBeInState("Approved", "be announced"),
      );
      return;
    }
    const override = interaction.options.getChannel("channel");
    const channelId = override?.id ?? guildConfig?.eventAnnouncementChannel;
    const channel = channelId
      ? await bot.channels.fetch(channelId).catch(() => null)
      : null;
    if (!channel?.isSendable()) {
      await interaction.editReply(
        "Unable to find a configured/inputted announcement channel!",
      );
      return;
    }
    const { event, message } = await withAnnouncementLock(id, async () => {
      const announced = await client.transition(id, "announced", actor);
      return {
        event: announced,
        message: await postEngineAnnouncement(
          bot,
          client,
          announced,
          channel,
          guildConfig,
          interaction.guild?.iconURL(),
        ),
      };
    });
    await interaction.editReply(
      `Announced event \`${event.id}\` in ${message.url} and marked it **Announced**.`,
    );
  },
);

const handleStats = engineCommand(
  "events > stats (engine)",
  async (_bot, interaction, client) => {
    await interaction.deferReply();
    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }
    const query = toEngineStatsWindow(
      interaction.options.getString("preset"),
      resolved.window,
    );
    const target = interaction.options.getUser("user") ?? interaction.user;
    const stats = await fetchMemberStats(
      client,
      query,
      interactionActor(interaction),
      target.id,
    );
    if (!stats) {
      await interaction.editReply(
        `${target.username} hasn't taken part in this club's events yet.`,
      );
      return;
    }
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildEngineMemberStatsContainer(stats)],
    });
  },
);

const handleServerStats = engineCommand(
  "events > serverStats (engine)",
  async (_bot, interaction, client) => {
    await interaction.deferReply();
    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }
    const overview = await client.getOverview(
      toEngineStatsWindow(
        interaction.options.getString("preset"),
        resolved.window,
      ),
    );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [
        buildEngineOverviewContainer(
          overview,
          interaction.guild?.name ?? "Server",
        ),
      ],
    });
  },
);

const handleReaderboard = engineCommand(
  "user > readerboard (engine)",
  async (bot, interaction, client) => {
    await interaction.deferReply();
    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }
    const owsType = interaction.options.getString("type");
    const query = {
      ...toEngineStatsWindow(
        interaction.options.getString("preset"),
        resolved.window,
      ),
      ...(owsType ? { typeKey: engineTypeKey(owsType) } : {}),
    };
    const actor = interactionActor(interaction);
    const entries: EngineLeaderboardEntry[] = [];
    let me: EngineLeaderboardEntry | null = null;
    let total = 0;
    for (let page = 1; page <= LEADERBOARD_MAX_PAGES; page += 1) {
      const board = await client.getLeaderboard(
        { ...query, page, pageSize: LEADERBOARD_PAGE_SIZE },
        actor,
      );
      entries.push(...board.items);
      me = board.me;
      total = board.total;
      if (entries.length >= board.total || board.items.length === 0) break;
    }
    if (entries.length === 0) {
      await interaction.editReply(errors.NoEventsForUserError);
      return;
    }
    const baseTitle = owsType
      ? `Server Readerboard · ${owsType}`
      : "Server Readerboard";
    const manager = new PaginationManager<EngineLeaderboardEntry>(
      10,
      entries,
      bot,
      (title, data, ix, pageInfo) =>
        buildEngineLeaderboardContainer(title, data, ix, pageInfo, {
          me,
          total,
        }),
      formatWindowTitle(baseTitle, resolved.window),
    );
    const message = await interaction.editReply(
      manager.createMessagePayloadForPage(interaction),
    );
    manager.createCollectors(message, interaction, 5 * 60 * 1000);
  },
);

/**
 * Shows the event request modal and creates the event as the actor. Shared by
 * `/events request` and the "Request Buddy Read" button on `/book info`.
 *
 * @param bot The bot instance.
 * @param interaction The slash command or button interaction.
 * @param client The installation client.
 * @param guildConfig The guild config.
 * @param owsType The OWS event type (e.g. "BuddyRead").
 * @param prefill An optional book URL, ISBN or catalogue id to pre-fill.
 */
export async function runEngineRequestFlow(
  bot: Bot,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  client: EngineInstallationClient,
  guildConfig: GuildsConfig | undefined,
  owsType: string,
  prefill?: string,
) {
  const typeKey = engineTypeKey(owsType);
  const withDates = typeKey !== "book-of-the-month";
  const customId = `${REQUEST_MODAL_ID}${Math.floor(Math.random() * 1e6)}`;
  await interaction.showModal(
    buildRequestModal(customId, owsType, withDates, prefill),
  );
  let submit: ModalSubmitInteraction;
  try {
    submit = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === customId,
      time: MODAL_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof DiscordjsError) return;
    throw err;
  }
  await submit.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const bookInput = submit.fields.getTextInputValue(BOOK_FIELD_ID).trim();
    const reference = parseBookReference(bookInput);
    if (!reference) {
      await submit.editReply(
        templates.invalidSubmission(
          "Use a Goodreads, StoryGraph or Open Library book URL, an ISBN, or a book ID from `/book search` or `/book add`",
        ),
      );
      return;
    }
    let startDate: string | null;
    let endDate: string | null;
    if (withDates) {
      startDate = toCalendarDateInput(
        submit.fields.getTextInputValue(START_FIELD_ID),
      );
      endDate = toCalendarDateInput(
        submit.fields.getTextInputValue(END_FIELD_ID),
      );
    } else {
      [startDate, endDate] = nextMonthRange((await client.getClub()).today);
    }
    if (!startDate || !endDate) {
      await submit.editReply(templates.invalidSubmission("Invalid date"));
      return;
    }
    const book =
      reference.kind === "catalog"
        ? await client.getBook(reference.bookId)
        : await client.importBook(reference.ref);
    const event = await client.createEvent(
      {
        typeKey,
        bookId: book.id,
        description: submit.fields.getTextInputValue(REASON_FIELD_ID),
        startDate,
        endDate,
        leadSelf: true,
      },
      interactionActor(submit),
    );
    try {
      await postRequestMessage(bot, client, submit, event, guildConfig);
    } catch (err) {
      logger.warn(
        { err },
        `Unable to post the request message for ${event.id}`,
      );
    }
    await submit.editReply(
      templates.eventRequestSuccess(event.title, event.id),
    );
  } catch (err) {
    const message = engineErrorMessage(err);
    await submit.editReply(message ?? errors.SomethingWentWrongError);
    if (!message) {
      await errorHandler(
        bot,
        "commands > events > request (engine) > modal",
        err,
        submit.guild?.name,
        undefined,
        submit,
      );
    }
  }
}

/**
 * Engine implementations of `/events` subcommands, used instead of the OWS
 * handlers when `BACKEND=engine`.
 */
export const engineEventHandlers: Record<string, CommandHandler> = {
  ...engineListHandlers,
  ...engineStaffHandlers,
  request: handleRequest,
  info: handleInfo,
  createthread: handleCreateThread,
  announce: handleAnnounce,
  stats: handleStats,
  serverstats: handleServerStats,
};

/**
 * Engine implementations of `/user` subcommands.
 */
export const engineUserHandlers: Record<string, CommandHandler> = {
  ...engineUserExtraHandlers,
  readerboard: handleReaderboard,
};
