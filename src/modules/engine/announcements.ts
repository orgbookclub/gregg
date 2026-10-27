import { GuildsConfig } from "@prisma/client";
import {
  ChannelType,
  ForumChannel,
  Message,
  SendableChannels,
} from "discord.js";

import { Bot } from "../../models";
import {
  createEventMessageDoc,
  getGuildConfigFromDb,
} from "../../utils/dbUtils";
import { logger } from "../../utils/logHandler";

import { EngineInstallationClient } from "./client";
import {
  buildEngineEventEmbed,
  buildEngineParticipationRow,
  engineThreadTitle,
} from "./embeds";
import { discordThreadIds, discordThreadLink, withDiscordLink } from "./links";
import { formatCalendarDate, formatEngineUser } from "./mappings";
import { EngineEventDetail, EngineEventStatus } from "./types";

const ANNOUNCEMENT_MESSAGE_TYPE = "Announcement";
const FEED_ANNOUNCE_STATUSES: EngineEventStatus[] = ["announced", "ongoing"];

const announcing = new Set<string>();

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

/**
 * Runs an announcement while marking the event as being announced from
 * Discord, so the feed consumer doesn't post a second announcement for the
 * same status change.
 *
 * @param eventId The event id.
 * @param run The announcement.
 * @returns The announcement's result.
 */
export async function withAnnouncementLock<T>(
  eventId: string,
  run: () => Promise<T>,
): Promise<T> {
  announcing.add(eventId);
  try {
    return await run();
  } finally {
    announcing.delete(eventId);
  }
}

/**
 * Whether an announcement for the event is being posted from Discord right
 * now.
 *
 * @param eventId The event id.
 * @returns True while `withAnnouncementLock` runs for the event.
 */
export function isAnnouncing(eventId: string): boolean {
  return announcing.has(eventId);
}

/**
 * Posts the announcement message for an announced event, records it so the
 * feed keeps it up to date, and links it in the event's Discord threads.
 *
 * @param bot The bot instance.
 * @param client The guild's installation client.
 * @param event The announced event.
 * @param channel The announcement channel.
 * @param guildConfig The guild config.
 * @param iconUrl The guild icon for the embed.
 * @returns The announcement message.
 */
export async function postEngineAnnouncement(
  bot: Bot,
  client: EngineInstallationClient,
  event: EngineEventDetail,
  channel: SendableChannels,
  guildConfig: GuildsConfig | null | undefined,
  iconUrl?: string | null,
): Promise<Message> {
  const participants = await client.listParticipants(event.id);
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
      buildEngineEventEmbed(event, participants, "announcement", iconUrl),
    ],
    components: [buildEngineParticipationRow(event.id, "ea")],
  });
  await createEventMessageDoc(
    bot,
    client.guildId,
    event.id,
    message,
    ANNOUNCEMENT_MESSAGE_TYPE,
  );
  await linkAnnouncementInThreads(bot, event, message);
  return message;
}

/**
 * Posts the Discord announcement for an event that was announced outside
 * Discord (by the engine's scheduler under the event type's announce policy,
 * or by staff in the web app). Does nothing when Gregg already posted an
 * announcement for the event, when one is being posted from Discord, when the
 * event has moved past `ongoing`, or when the guild has no announcement
 * channel.
 *
 * @param bot The bot instance.
 * @param client The guild's installation client.
 * @param eventId The event id.
 * @returns The announcement message, or null when nothing was posted.
 */
export async function announceFromFeed(
  bot: Bot,
  client: EngineInstallationClient,
  eventId: string,
): Promise<Message | null> {
  if (isAnnouncing(eventId)) return null;
  const existing = await bot.db.eventMessages.findFirst({
    where: {
      eventId,
      guildId: client.guildId,
      type: ANNOUNCEMENT_MESSAGE_TYPE,
    },
  });
  if (existing) return null;
  const guildConfig = await getGuildConfigFromDb(bot, client.guildId);
  if (!guildConfig?.eventAnnouncementChannel) return null;
  const event = await client.getEvent(eventId);
  if (!FEED_ANNOUNCE_STATUSES.includes(event.status)) return null;
  if (isAnnouncing(eventId)) return null;
  const channel = await bot.channels
    .fetch(guildConfig.eventAnnouncementChannel)
    .catch(() => null);
  if (!channel?.isSendable()) {
    logger.warn(
      `Announcement channel ${guildConfig.eventAnnouncementChannel} is not usable; skipping announcement for ${eventId}`,
    );
    return null;
  }
  const iconUrl = bot.guilds.cache.get(client.guildId)?.iconURL() ?? null;
  return await postEngineAnnouncement(
    bot,
    client,
    event,
    channel,
    guildConfig,
    iconUrl,
  );
}

/**
 * Finds the forum configured for an event type (buddy reads and books of the
 * month).
 *
 * @param bot The bot instance.
 * @param typeKey The engine event type key.
 * @param guildConfig The guild config.
 * @returns The forum, or null when none is configured.
 */
export async function configuredForum(
  bot: Bot,
  typeKey: string,
  guildConfig?: GuildsConfig | null,
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

/**
 * Creates the discussion post for an event in a forum, pins its starter
 * message, and attaches the thread to the event as a Discord link (other
 * links are kept).
 *
 * @param bot The bot instance.
 * @param client The guild's installation client.
 * @param event The event.
 * @param forum The forum.
 * @param title The post title; defaults to the book title.
 * @returns The thread id.
 */
export async function createEngineForumThread(
  bot: Bot,
  client: EngineInstallationClient,
  event: EngineEventDetail,
  forum: ForumChannel,
  title?: string | null,
): Promise<string> {
  const participants = await client.listParticipants(event.id);
  const leaders = participants
    .filter((p) => p.isLeader)
    .map((p) => formatEngineUser(p.user));
  const ongoingTag = forum.availableTags.find((tag) => tag.name === "ongoing");
  const post = await forum.threads.create({
    name: title || engineThreadTitle(event),
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
  await client.putLinks(
    event.id,
    withDiscordLink(
      event.externalLinks,
      discordThreadLink(client.guildId, { id: post.id, name: post.name }),
    ),
  );
  return post.id;
}
