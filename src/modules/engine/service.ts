import { Colors, EmbedBuilder, Guild, TextBasedChannel } from "discord.js";

import { titles } from "../../config/constants";
import { Bot } from "../../models";
import { getGuildConfigFromDb } from "../../utils/dbUtils";
import { logToWebhook, logger } from "../../utils/logHandler";

import { announceFromFeed } from "./announcements";
import { EngineClient, EngineError, EngineInstallationClient } from "./client";
import {
  buildEngineEventEmbed,
  buildEngineParticipationRow,
  EngineEmbedKind,
  isTerminalStatus,
} from "./embeds";
import {
  FeedConsumer,
  FeedCursorStore,
  FeedSource,
  FeedStatusChange,
  summarizeFeed,
} from "./feed";
import { engineStatusLabel } from "./mappings";
import {
  isTierSyncEnabled,
  planTierRoleChanges,
  resolveTierRoleMap,
} from "./tierRoles";
import { EngineFeedEntry } from "./types";

const MESSAGE_KINDS: Record<
  string,
  { kind: EngineEmbedKind; prefix: "er" | "ea" }
> = {
  BRRequest: { kind: "request", prefix: "er" },
  Announcement: { kind: "announcement", prefix: "ea" },
};

const MAX_EXTERNAL_ROLES = 250;

function prismaCursorStore(bot: Bot): FeedCursorStore {
  return {
    get: async (installationId) => {
      const doc = await bot.db.engineFeedCursors.findUnique({
        where: { installationId },
      });
      return doc?.cursor ?? null;
    },
    set: async (installationId, guildId, cursor) => {
      await bot.db.engineFeedCursors.upsert({
        where: { installationId },
        update: { cursor, guildId, updatedOn: new Date() },
        create: { installationId, guildId, cursor, updatedOn: new Date() },
      });
    },
  };
}

/**
 * Re-renders every request and announcement message Gregg posted for an
 * event from the engine's current state. Buttons are disabled once the event
 * is completed, rejected or cancelled.
 *
 * @param bot The bot instance.
 * @param client The guild's installation client.
 * @param eventId The event id.
 * @returns The number of messages updated.
 */
async function refreshEventMessages(
  bot: Bot,
  client: EngineInstallationClient,
  eventId: string,
): Promise<number> {
  const docs = await bot.db.eventMessages.findMany({
    where: { eventId, guildId: client.guildId },
  });
  const targets = docs.filter((doc) => MESSAGE_KINDS[doc.type]);
  if (targets.length === 0) return 0;
  let event;
  try {
    event = await client.getEvent(eventId);
  } catch (error) {
    if (error instanceof EngineError && error.status === 404) return 0;
    throw error;
  }
  const participants = await client.listParticipants(eventId);
  const iconUrl = bot.guilds.cache.get(client.guildId)?.iconURL() ?? null;
  let updated = 0;
  for (const doc of targets) {
    const { kind, prefix } = MESSAGE_KINDS[doc.type];
    try {
      const channel = await bot.channels.fetch(doc.channelId);
      if (!channel?.isTextBased()) continue;
      const message = await (channel as TextBasedChannel).messages.fetch(
        doc.messageId,
      );
      await message.edit({
        content: message.content || null,
        embeds: [buildEngineEventEmbed(event, participants, kind, iconUrl)],
        components: [
          buildEngineParticipationRow(
            event.id,
            prefix,
            isTerminalStatus(event.status),
          ),
        ],
      });
      updated += 1;
    } catch (error) {
      logger.warn(
        { err: error },
        `Unable to refresh message ${doc.messageId} in channel ${doc.channelId} for event ${eventId}`,
      );
    }
  }
  return updated;
}

async function logStatusChanges(
  bot: Bot,
  guildId: string,
  changes: FeedStatusChange[],
) {
  if (changes.length === 0) return;
  const config = await getGuildConfigFromDb(bot, guildId);
  if (!config?.logWebhookUrl) return;
  const lines = changes.map(
    (change) =>
      `\`${change.eventId}\`: ${change.from ? engineStatusLabel(change.from) : "—"} → **${engineStatusLabel(change.to)}**${change.reason ? ` (${change.reason})` : ""}`,
  );
  const embed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("Event Status Update")
    .setDescription(lines.join("\n").slice(0, 4000))
    .setTimestamp();
  await logToWebhook({ embeds: [embed] }, config.logWebhookUrl);
}

/**
 * Pushes the guild's role catalogue to the engine so club admins can map
 * Discord roles to club roles in the web app.
 *
 * @param guild The guild.
 * @param client The guild's installation client.
 */
async function pushRoleCatalog(
  guild: Guild,
  client: EngineInstallationClient,
): Promise<void> {
  const roles = await guild.roles.fetch();
  const catalog = [...roles.values()]
    .filter((role) => role.id !== guild.id && !role.managed)
    .sort((a, b) => b.position - a.position)
    .slice(0, MAX_EXTERNAL_ROLES)
    .map((role) => ({ id: role.id, name: role.name }));
  await client.putExternalRoles(catalog);
}

/**
 * Mirrors engine tier assignments onto Discord roles for one guild.
 *
 * @param bot The bot instance.
 * @param guild The guild.
 * @param client The guild's installation client.
 */
async function syncGuildTierRoles(
  bot: Bot,
  guild: Guild,
  client: EngineInstallationClient,
): Promise<void> {
  if (!isTierSyncEnabled(client.installation.publicSettings)) return;
  const [club, assignments, roles, members] = await Promise.all([
    client.getClub(),
    client.getTierAssignments(),
    guild.roles.fetch(),
    guild.members.fetch(),
  ]);
  const tierRoleMap = resolveTierRoleMap(
    club.readerTiers,
    [...roles.values()]
      .filter((role) => role.id !== guild.id && !role.managed)
      .map((role) => ({ id: role.id, name: role.name })),
    client.installation.publicSettings,
  );
  if (tierRoleMap.size === 0) return;
  const changes = planTierRoleChanges(
    assignments,
    tierRoleMap,
    [...members.values()]
      .filter((member) => !member.user.bot)
      .map((member) => ({ id: member.id, roleIds: member.roles.cache.keys() })),
  );
  if (changes.length === 0) return;
  const config = await getGuildConfigFromDb(bot, guild.id);
  const lines: string[] = [];
  for (const change of changes) {
    const member = members.get(change.memberId);
    if (!member) continue;
    try {
      if (change.action === "add") {
        await member.roles.add(change.roleId);
        lines.push(`<@&${change.roleId}> added to <@${change.memberId}>`);
      } else {
        await member.roles.remove(change.roleId);
        lines.push(`<@&${change.roleId}> removed from <@${change.memberId}>`);
      }
    } catch (error) {
      logger.warn(
        { err: error },
        `Unable to ${change.action} role ${change.roleId} for ${change.memberId}`,
      );
    }
  }
  if (lines.length > 0 && config?.logWebhookUrl) {
    const embed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle(titles.ReaderRoleUpdate)
      .setDescription(lines.join("\n").slice(0, 4000))
      .setTimestamp();
    await logToWebhook({ embeds: [embed] }, config.logWebhookUrl);
  }
}

/**
 * Engine integration attached to the bot as `bot.engine` when
 * `BACKEND=engine`: the API client plus the feed consumer and the Discord
 * sync routines built on it.
 */
export class EngineService {
  readonly client: EngineClient;
  readonly feed: FeedConsumer;
  private readonly bot: Bot;

  /**
   * Creates the service.
   *
   * @param bot The bot instance.
   * @param client The engine client.
   */
  constructor(bot: Bot, client: EngineClient) {
    this.bot = bot;
    this.client = client;
    this.feed = new FeedConsumer({
      store: prismaCursorStore(bot),
      handler: (source, entries) => this.handleFeedEntries(source, entries),
    });
  }

  /**
   * Returns the installation client for a guild, or null when not linked.
   *
   * @param guildId The guild id.
   * @returns The installation client, or null.
   */
  async forGuild(guildId: string): Promise<EngineInstallationClient | null> {
    return await this.client.forGuild(guildId);
  }

  /**
   * Returns the installation clients of every guild Gregg is in that is
   * linked to a club.
   *
   * @returns The installation clients.
   */
  async linkedGuilds(): Promise<
    { guild: Guild; client: EngineInstallationClient }[]
  > {
    const linked: { guild: Guild; client: EngineInstallationClient }[] = [];
    for (const guild of this.bot.guilds.cache.values()) {
      try {
        const client = await this.client.forGuild(guild.id);
        if (client) linked.push({ guild, client });
      } catch (error) {
        logger.warn({ err: error }, `Engine lookup failed for ${guild.id}`);
      }
    }
    return linked;
  }

  /**
   * Polls the feed of every linked guild once.
   */
  async pollFeeds(): Promise<void> {
    await this.forEachLinkedGuild("feed poll", ({ client }) =>
      this.feed.poll(client),
    );
  }

  /**
   * Syncs tier roles in every linked guild.
   */
  async syncTierRoles(): Promise<void> {
    await this.forEachLinkedGuild("tier role sync", ({ guild, client }) =>
      syncGuildTierRoles(this.bot, guild, client),
    );
  }

  /**
   * Pushes the role catalogue of every linked guild.
   */
  async pushRoleCatalogs(): Promise<void> {
    await this.forEachLinkedGuild("role catalogue push", ({ guild, client }) =>
      pushRoleCatalog(guild, client),
    );
  }

  /**
   * Refreshes the Discord messages for an event.
   *
   * @param client The guild's installation client.
   * @param eventId The event id.
   * @returns The number of messages updated.
   */
  async refreshEvent(
    client: EngineInstallationClient,
    eventId: string,
  ): Promise<number> {
    return await refreshEventMessages(this.bot, client, eventId);
  }

  private async forEachLinkedGuild(
    label: string,
    run: (linked: {
      guild: Guild;
      client: EngineInstallationClient;
    }) => Promise<unknown>,
  ): Promise<void> {
    for (const linked of await this.linkedGuilds()) {
      try {
        await run(linked);
      } catch (error) {
        logger.warn(
          { err: error },
          `Engine ${label} failed for ${linked.guild.id}`,
        );
      }
    }
  }

  private async handleFeedEntries(
    source: FeedSource,
    entries: EngineFeedEntry[],
  ): Promise<void> {
    const client = source as EngineInstallationClient;
    const summary = summarizeFeed(entries);
    for (const eventId of summary.eventIds) {
      try {
        await refreshEventMessages(this.bot, client, eventId);
      } catch (error) {
        logger.warn({ err: error }, `Feed refresh failed for event ${eventId}`);
      }
    }
    const announced = new Set(
      summary.statusChanges
        .filter((change) => change.to === "announced")
        .map((change) => change.eventId),
    );
    for (const eventId of announced) {
      try {
        await announceFromFeed(this.bot, client, eventId);
      } catch (error) {
        logger.warn(
          { err: error },
          `Feed announcement failed for event ${eventId}`,
        );
      }
    }
    try {
      await logStatusChanges(this.bot, client.guildId, summary.statusChanges);
    } catch (error) {
      logger.warn({ err: error }, `Status log failed for ${client.guildId}`);
    }
  }
}

export { pushRoleCatalog, refreshEventMessages, syncGuildTierRoles };
