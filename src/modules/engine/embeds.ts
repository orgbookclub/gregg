import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
} from "discord.js";

import { labels } from "../../config/constants";
import { customSubstring } from "../../utils/stringUtils";

import { discordThreadIds } from "./links";
import {
  engineStatusLabel,
  engineTypeEmoji,
  formatCalendarDate,
  formatEngineUser,
} from "./mappings";
import {
  EngineEventDetail,
  EngineEventStatus,
  EngineParticipant,
} from "./types";

const TERMINAL_STATUSES: EngineEventStatus[] = [
  "completed",
  "rejected",
  "cancelled",
];

const MAX_LISTED_USERS = 40;

function userList(participants: EngineParticipant[]): string {
  const shown = participants
    .slice(0, MAX_LISTED_USERS)
    .map((p) => formatEngineUser(p.user));
  const more = participants.length - shown.length;
  const text = shown.join(", ") + (more > 0 ? ` and ${more} more` : "");
  return customSubstring(text, 1000);
}

function eventTitle(event: EngineEventDetail): string {
  const authors = event.book?.authors.slice(0, 3).join(", ");
  return customSubstring(
    authors ? `${event.title} - ${authors}` : event.title,
    100,
  );
}

/**
 * Which Discord surface an engine event is rendered for.
 */
export type EngineEmbedKind = "request" | "announcement" | "info";

/**
 * Whether an event can no longer change participation (buttons disabled).
 *
 * @param status The event status.
 * @returns True for completed, rejected and cancelled.
 */
export function isTerminalStatus(status: EngineEventStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Builds the title used for an event's forum thread.
 *
 * @param event The event.
 * @returns The title (max 100 chars).
 */
export function engineThreadTitle(event: EngineEventDetail): string {
  return eventTitle(event);
}

/**
 * Renders an engine event as a Discord embed. Mirrors the OWS request,
 * announcement and info embeds.
 *
 * @param event The event.
 * @param participants The event's participants.
 * @param kind The surface the embed is for.
 * @param iconUrl The guild icon.
 * @returns The embed.
 */
export function buildEngineEventEmbed(
  event: EngineEventDetail,
  participants: EngineParticipant[],
  kind: EngineEmbedKind,
  iconUrl?: string | null,
): EmbedBuilder {
  const emoji = engineTypeEmoji(event.type.key);
  const author =
    kind === "request"
      ? `${emoji} ${event.type.name} Request · ${engineStatusLabel(event.status)}`
      : `${emoji} ${engineStatusLabel(event.status)} ${event.type.name}`;
  const embed = new EmbedBuilder()
    .setTitle(eventTitle(event))
    .setFooter({ text: `Event ID: ${event.id}` })
    .setColor(kind === "request" ? Colors.DarkGold : Colors.Gold)
    .setAuthor({ name: author, iconURL: iconUrl ?? undefined });
  if (event.book?.coverUrl) embed.setThumbnail(event.book.coverUrl);
  if (event.description) {
    embed.addFields({
      name: kind === "request" ? "Request Reason" : "Description",
      value: customSubstring(event.description, 1000),
    });
  }
  embed.addFields(
    {
      name: "Start Date",
      value: formatCalendarDate(event.startDate),
      inline: true,
    },
    {
      name: "End Date",
      value: formatCalendarDate(event.endDate),
      inline: true,
    },
  );
  if (kind !== "request" && event.book?.pageCount) {
    embed.addFields({
      name: "Pages 📄",
      value: event.book.pageCount.toString(),
      inline: true,
    });
  }
  const threads = discordThreadIds(event.externalLinks);
  if (kind === "info" && threads.length > 0) {
    embed.addFields({
      name: "Thread(s)",
      value: threads.map((id) => `<#${id}>`).join(", "),
    });
  }
  if (event.requestedBy) {
    embed.addFields({
      name: "Requested By",
      value: formatEngineUser(event.requestedBy),
    });
  }
  const leaders = participants.filter((p) => p.isLeader);
  if (leaders.length > 0) {
    embed.addFields({ name: "Leader(s)", value: userList(leaders) });
  }
  const interested = participants.filter((p) => p.interested);
  if (interested.length > 0) {
    embed.addFields({
      name: `Interested (${interested.length})`,
      value: userList(interested),
    });
  }
  const readers = participants.filter((p) => p.completion === "completed");
  if (kind !== "request" && readers.length > 0) {
    embed.addFields({
      name: `Reader(s) (${readers.length})`,
      value: userList(readers),
    });
  }
  return embed;
}

/**
 * Builds the Join / Leave / Lead buttons for request (`er`) and
 * announcement (`ea`) messages. Custom ids keep the `<prefix>-<eventId>-<action>`
 * scheme.
 *
 * @param eventId The event id.
 * @param prefix The message type prefix.
 * @param disabled Whether the buttons are disabled.
 * @returns The action row.
 */
export function buildEngineParticipationRow(
  eventId: string,
  prefix: "er" | "ea",
  disabled = false,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel(labels.Join)
      .setEmoji({ name: "✅" })
      .setStyle(ButtonStyle.Success)
      .setCustomId(`${prefix}-${eventId}-interested`)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setLabel(labels.Leave)
      .setEmoji({ name: "⛔" })
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`${prefix}-${eventId}-notInterested`)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setLabel(labels.Lead)
      .setEmoji({ name: "🧭" })
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`${prefix}-${eventId}-lead`)
      .setDisabled(disabled),
  );
}

/**
 * Builds the staff buttons for an event's info card from the transitions the
 * engine allows for the viewing actor, or null when there are none.
 *
 * @param event The event, fetched with the viewer as actor.
 * @returns The action row, or null.
 */
export function buildEngineStaffRow(
  event: EngineEventDetail,
): ActionRowBuilder<ButtonBuilder> | null {
  const buttons: ButtonBuilder[] = [];
  if (event.allowedTransitions.includes("approved")) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`evt-approve-${event.id}`)
        .setLabel(labels.Approve)
        .setEmoji({ name: "✅" })
        .setStyle(ButtonStyle.Success),
    );
  }
  if (event.allowedTransitions.includes("rejected")) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`evt-reject-${event.id}`)
        .setLabel(labels.Reject)
        .setEmoji({ name: "✖️" })
        .setStyle(ButtonStyle.Danger),
    );
  }
  if (event.permissions.canRecordResults) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`evt-addpts-${event.id}`)
        .setLabel(labels.AddPoints)
        .setEmoji({ name: "➕" })
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`evt-rmpts-${event.id}`)
        .setLabel(labels.RemovePoints)
        .setEmoji({ name: "➖" })
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (buttons.length === 0) return null;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}
