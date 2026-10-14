import { GuildsConfig } from "@prisma/client";
import {
  ChannelType,
  ChatInputCommandInteraction,
  DiscordjsError,
  ForumChannel,
  LabelBuilder,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { errors, placeholders, templates } from "../../../config/constants";
import { Bot, CommandHandler } from "../../../models";
import { getOpenLibraryWorkId } from "../../../utils/bookUtils";
import {
  formatWindowTitle,
  resolveDateWindow,
} from "../../../utils/dateWindow";
import { createEventMessageDoc } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import { logger } from "../../../utils/logHandler";
import { PaginationManager } from "../../../utils/paginationManager";
import { EngineInstallationClient } from "../client";
import {
  buildEngineEventEmbed,
  buildEngineParticipationRow,
  buildEngineStaffRow,
  engineThreadTitle,
} from "../embeds";
import { discordThreadIds, discordThreadLink, withDiscordLink } from "../links";
import {
  engineTypeKey,
  formatCalendarDate,
  formatEngineUser,
  nextMonthRange,
  toEngineStatsWindow,
} from "../mappings";
import { EngineEventDetail, EngineLeaderboardEntry } from "../types";

import {
  engineErrorMessage,
  interactionActor,
  replyOrEdit,
  requireInstallation,
} from "./common";
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
const ISBN_PATTERN = /^(?:\d[\d-]{8,15}[\dXx])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const THREAD_STATUSES = ["approved", "announced", "ongoing"];
const LEADERBOARD_PAGE_SIZE = 100;
const LEADERBOARD_MAX_PAGES = 5;

type EngineHandler = (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
  client: EngineInstallationClient,
  guildConfig?: GuildsConfig,
) => Promise<void>;

/**
 * Wraps an engine handler: resolves the installation, maps expected engine
 * refusals to replies and reports everything else.
 *
 * @param area The breadcrumb for error reports.
 * @param handler The handler.
 * @returns The command handler.
 */
function engineCommand(area: string, handler: EngineHandler): CommandHandler {
  return async (bot, interaction, guildConfig) => {
    try {
      const client = await requireInstallation(bot, interaction);
      if (!client) return;
      await handler(bot, interaction, client, guildConfig);
    } catch (err) {
      const message = engineErrorMessage(err);
      if (message) {
        await replyOrEdit(interaction, message);
        return;
      }
      await replyOrEdit(interaction, errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        `commands > ${area}`,
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  };
}

function toCalendarDate(raw: string): string | null {
  const value = raw.trim();
  if (DATE_PATTERN.test(value)) return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

function buildRequestModal(
  customId: string,
  typeLabel: string,
  withDates: boolean,
) {
  const labelsList: LabelBuilder[] = [
    new LabelBuilder()
      .setLabel("Book (Open Library URL or ISBN)")
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId(BOOK_FIELD_ID)
          .setRequired(true)
          .setPlaceholder(placeholders.BookLinkExample)
          .setStyle(TextInputStyle.Short),
      ),
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
    const owsType = interaction.options.getString("type", true);
    const typeKey = engineTypeKey(owsType);
    const withDates = typeKey !== "book-of-the-month";
    const customId = `${REQUEST_MODAL_ID}${Math.floor(Math.random() * 1e6)}`;
    await interaction.showModal(
      buildRequestModal(customId, owsType, withDates),
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
      const workId = getOpenLibraryWorkId(bookInput);
      const isbn = ISBN_PATTERN.test(bookInput)
        ? bookInput.replace(/-/g, "")
        : null;
      if (!workId && !isbn) {
        await submit.editReply(
          templates.invalidSubmission(
            "Use an Open Library work URL or an ISBN",
          ),
        );
        return;
      }
      let startDate: string | null;
      let endDate: string | null;
      if (withDates) {
        startDate = toCalendarDate(
          submit.fields.getTextInputValue(START_FIELD_ID),
        );
        endDate = toCalendarDate(submit.fields.getTextInputValue(END_FIELD_ID));
      } else {
        [startDate, endDate] = nextMonthRange((await client.getClub()).today);
      }
      if (!startDate || !endDate) {
        await submit.editReply(templates.invalidSubmission("Invalid date"));
        return;
      }
      const book = await client.importBook(
        workId ? { openLibraryWorkId: workId } : { isbn: isbn ?? undefined },
      );
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

function threadStarterContent(
  event: EngineEventDetail,
  leaders: string[],
): string {
  let content = `### From ${formatCalendarDate(event.startDate)} to ${formatCalendarDate(event.endDate)}`;
  if (leaders.length > 0) content += ` | Leader(s): ${leaders.join(", ")}`;
  if (event.book?.coverUrl) content += `\n**Cover**: ${event.book.coverUrl}`;
  content += `\n\n**ID**: \`${event.id}\``;
  return content;
}

async function configuredForum(
  bot: Bot,
  typeKey: string,
  guildConfig?: GuildsConfig,
): Promise<ForumChannel | null> {
  const channelId =
    typeKey === "buddy-read"
      ? guildConfig?.brForumChannel
      : typeKey === "book-of-the-month"
        ? guildConfig?.mrForumChannel
        : undefined;
  if (!channelId) return null;
  const channel = await bot.channels.fetch(channelId).catch(() => null);
  return channel?.type === ChannelType.GuildForum ? channel : null;
}

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
    let threadId: string;
    let threadName: string;
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
      threadId = channel.id;
      threadName = title ?? channel.name;
    } else {
      const forum =
        (channel as ForumChannel | null) ??
        (await configuredForum(bot, event.type.key, guildConfig));
      if (!forum) {
        await interaction.editReply(
          "Unable to find a configured/inputted forum channel!",
        );
        return;
      }
      const participants = await client.listParticipants(id);
      const leaders = participants
        .filter((p) => p.isLeader)
        .map((p) => formatEngineUser(p.user));
      const ongoingTag = forum.availableTags.find(
        (tag) => tag.name === "ongoing",
      );
      const post = await forum.threads.create({
        name: title ?? engineThreadTitle(event),
        message: { content: threadStarterContent(event, leaders) },
        appliedTags: ongoingTag ? [ongoingTag.id] : [],
      });
      const starter = await post.fetchStarterMessage();
      if (starter) {
        await starter.pin();
        await createEventMessageDoc(
          bot,
          client.guildId,
          event.id,
          starter,
          "eventThreadStarterMessage",
        );
      }
      threadId = post.id;
      threadName = post.name;
    }
    await client.putLinks(
      event.id,
      withDiscordLink(
        event.externalLinks,
        discordThreadLink(client.guildId, { id: threadId, name: threadName }),
      ),
    );
    await interaction.editReply(templates.threadCreated(threadId, event.id));
  },
);

async function linkAnnouncementInThreads(
  bot: Bot,
  event: EngineEventDetail,
  announcement: Message,
) {
  for (const threadId of discordThreadIds(event.externalLinks)) {
    try {
      const thread = await bot.channels.fetch(threadId);
      if (thread?.isSendable()) {
        await thread.send(`**Announcement**: ${announcement.url}`);
      }
    } catch (error) {
      logger.warn(
        { err: error },
        `Unable to post announcement link in ${threadId}`,
      );
    }
  }
}

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
    const event = await client.transition(id, "announced", actor);
    const participants = await client.listParticipants(id);
    const threads = discordThreadIds(event.externalLinks);
    const ping = guildConfig?.serverEventsRole
      ? `<@&${guildConfig.serverEventsRole}> `
      : "";
    const message = await channel.send({
      content:
        `${ping}New ${event.type.name}! Please click on the Join ✅ button if you'd like to be pinged for discussions.` +
        (threads.length > 0
          ? `\nDiscussion will take place in ${threads.map((t) => `<#${t}>`).join(", ")}`
          : ""),
      embeds: [
        buildEngineEventEmbed(
          event,
          participants,
          "announcement",
          interaction.guild?.iconURL(),
        ),
      ],
      components: [buildEngineParticipationRow(event.id, "ea")],
    });
    await createEventMessageDoc(
      bot,
      client.guildId,
      event.id,
      message,
      "Announcement",
    );
    await linkAnnouncementInThreads(bot, event, message);
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
 * Engine implementations of `/events` subcommands, used instead of the OWS
 * handlers when `BACKEND=engine`.
 */
export const engineEventHandlers: Record<string, CommandHandler> = {
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
  readerboard: handleReaderboard,
};
