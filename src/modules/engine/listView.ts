import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";

import {
  engineStatusLabel,
  engineTypeEmoji,
  formatCalendarDate,
} from "./mappings";
import { EngineEventListItem } from "./types";

const JOINABLE = ["requested", "approved", "announced", "ongoing"];

function separator() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

/**
 * Returns the Join or Leave button for the viewer on a buddy read, based on
 * the viewer's participation (`me`), or null when neither applies.
 *
 * @param event The event, listed with the viewer as actor.
 * @returns The button, or null.
 */
export function engineParticipantButton(
  event: EngineEventListItem,
): ButtonBuilder | null {
  if (event.type.key !== "buddy-read" || !JOINABLE.includes(event.status)) {
    return null;
  }
  if (event.me?.interested) {
    if (event.me.isLeader && event.status === "ongoing") return null;
    return new ButtonBuilder()
      .setCustomId(`evt-leave-${event.id}`)
      .setLabel("Leave")
      .setEmoji({ name: "🚪" })
      .setStyle(ButtonStyle.Danger);
  }
  if (event.me) return null;
  return new ButtonBuilder()
    .setCustomId(`evt-join-${event.id}`)
    .setLabel("Join")
    .setEmoji({ name: "✅" })
    .setStyle(ButtonStyle.Success);
}

/**
 * Renders a page of engine events in the same layout as the OWS event list.
 *
 * @param title The heading.
 * @param events The events on this page.
 * @param interaction The interaction.
 * @param showTypeAndStatus Whether to show type and status per row.
 * @param subtitle An optional subtitle.
 * @param pageInfo The optional page position.
 * @param pageInfo.current The current page.
 * @param pageInfo.total The page count.
 * @returns The container.
 */
export function buildEngineEventListContainer(
  title: string,
  events: EngineEventListItem[],
  interaction: ChatInputCommandInteraction,
  showTypeAndStatus = false,
  subtitle?: string,
  pageInfo?: { current: number; total: number },
): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(Colors.Red);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`),
  );
  if (subtitle) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${subtitle}`),
    );
  }
  container.addSeparatorComponents(separator());
  for (const event of events) {
    const lines = [`### ${event.title}`];
    if (event.book?.authors.length) {
      lines.push(`-# by ${event.book.authors.slice(0, 3).join(", ")}`);
    }
    if (showTypeAndStatus) {
      lines.push(
        `> ${engineTypeEmoji(event.type.key)} ${event.type.name}  •  ${engineStatusLabel(event.status)}`,
      );
    }
    lines.push(
      `> __Start__: ${formatCalendarDate(event.startDate)} • __End__: ${formatCalendarDate(event.endDate)}`,
      `> 👥 ${event.counts.interested} interested · ID: \`${event.id}\``,
    );
    const section = new SectionBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join("\n")),
    );
    if (event.book?.coverUrl) {
      section.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(event.book.coverUrl),
      );
    }
    container.addSectionComponents(section);
    const buttons = [
      new ButtonBuilder()
        .setCustomId(`evt-info-${event.id}`)
        .setLabel("Details")
        .setEmoji({ name: "ℹ️" })
        .setStyle(ButtonStyle.Secondary),
    ];
    const participant = engineParticipantButton(event);
    if (participant) buttons.push(participant);
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons),
    );
  }
  const footer = [
    interaction.guild?.name ?? "",
    pageInfo ? `Page ${pageInfo.current} of ${pageInfo.total}` : "",
  ].filter((part) => part.length > 0);
  if (footer.length > 0) {
    container
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# ${footer.join(" · ")}`),
      );
  }
  return container;
}
