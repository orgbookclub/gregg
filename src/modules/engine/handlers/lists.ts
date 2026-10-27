import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { templates } from "../../../config/constants";
import { Bot } from "../../../models";
import { LazyPaginationManager } from "../../../utils/lazyPaginationManager";
import { EngineInstallationClient } from "../client";
import { buildEngineEventListContainer } from "../listView";
import { engineStatusLabel, formatEngineUser } from "../mappings";
import { engineListQuery } from "../staffActions";
import { EngineActor, EngineEventListItem } from "../types";

import { engineCommand, interactionActor } from "./common";

const UI_PAGE_SIZE = 4;
const API_PAGE_SIZE = 20;

/**
 * Renders a paginated list of engine events, fetching further pages lazily.
 *
 * @param bot The bot instance.
 * @param interaction The interaction (already deferred).
 * @param client The installation client.
 * @param actor The viewer, for Join/Leave buttons.
 * @param query The engine list query.
 * @param view How to title the list.
 * @param view.title The heading.
 * @param view.subtitle The optional subtitle.
 * @param view.showTypeAndStatus Whether rows show type and status.
 * @param view.empty The reply when nothing matches.
 */
async function replyWithEventList(
  bot: Bot,
  interaction: ChatInputCommandInteraction,
  client: EngineInstallationClient,
  actor: EngineActor,
  query: Record<string, string | boolean | undefined>,
  view: {
    title: string;
    subtitle?: string;
    showTypeAndStatus: boolean;
    empty: string;
  },
) {
  const fetchPage = (page: number) =>
    client.listEventsAs({ ...query, page, pageSize: API_PAGE_SIZE }, actor);
  const first = await fetchPage(1);
  if (first.total === 0) {
    await interaction.editReply(view.empty);
    return;
  }
  const manager = new LazyPaginationManager<EngineEventListItem>(
    UI_PAGE_SIZE,
    API_PAGE_SIZE,
    first.total,
    first.items,
    bot,
    (title, values, ix, pageInfo) =>
      buildEngineEventListContainer(
        title,
        values,
        ix,
        view.showTypeAndStatus,
        view.subtitle,
        pageInfo,
      ),
    async (apiPage) => (await fetchPage(apiPage)).items,
    view.title,
  );
  const message = await interaction.editReply(
    manager.createMessagePayloadForPage(interaction),
  );
  manager.createCollectors(message, interaction, 5 * 60 * 1000);
}

const handleList = engineCommand(
  "events > list (engine)",
  async (bot, interaction, client) => {
    await interaction.deferReply();
    const type = interaction.options.getString("type", true);
    const status = interaction.options.getString("status", true);
    await replyWithEventList(
      bot,
      interaction,
      client,
      interactionActor(interaction),
      engineListQuery({
        type,
        status,
        sort: interaction.options.getString("sort"),
      }),
      {
        title: "Events",
        subtitle: `${type} · ${status}`,
        showTypeAndStatus: false,
        empty: "There are no events to display with the given filters",
      },
    );
  },
);

const handleSearch = engineCommand(
  "events > search (engine)",
  async (bot, interaction, client) => {
    await interaction.deferReply();
    const q = interaction.options.getString("query", true);
    await replyWithEventList(
      bot,
      interaction,
      client,
      interactionActor(interaction),
      engineListQuery({
        q,
        type: interaction.options.getString("type"),
        status: interaction.options.getString("status"),
        sort: interaction.options.getString("sort"),
      }),
      {
        title: `Search: ${q}`.slice(0, 100),
        showTypeAndStatus: true,
        empty: templates.noEventsForQuery(q),
      },
    );
  },
);

const handleUserEvents = engineCommand(
  "user > events (engine)",
  async (bot, interaction, client) => {
    await interaction.deferReply();
    const target = interaction.options.getUser("user") ?? interaction.user;
    const actor = interactionActor(interaction);
    const type = interaction.options.getString("type", true);
    const status = interaction.options.getString("status", true);
    const self = target.id === interaction.user.id;
    let participant: string | undefined;
    if (!self) {
      const member = await client.findMemberByDiscordId(target.id);
      if (!member) {
        await interaction.editReply(
          `${target.username} hasn't taken part in this club's events yet.`,
        );
        return;
      }
      participant = member.user.id;
    }
    await replyWithEventList(
      bot,
      interaction,
      client,
      actor,
      engineListQuery({
        type,
        status,
        sort: interaction.options.getString("sort"),
        mine: self,
        participant,
      }),
      {
        title: `${target.username}'s Events`,
        subtitle: `${type} · ${status}`,
        showTypeAndStatus: false,
        empty: "No events found for the user for the chosen options",
      },
    );
  },
);

const handleUserInfo = engineCommand(
  "user > info (engine)",
  async (_bot, interaction, client) => {
    await interaction.deferReply();
    const target = interaction.options.getUser("user") ?? interaction.user;
    const member = await client.findMemberByDiscordId(target.id);
    if (!member) {
      await interaction.editReply(templates.noRegisteredUser(target.id));
      return;
    }
    const stats = await client.getMemberStats(member.user.id, {
      window: "all_time",
    });
    const embed = new EmbedBuilder()
      .setTitle(member.nickname ?? member.user.displayName)
      .setAuthor({
        name: interaction.guild?.name ?? "Guild Name Unavailable",
        iconURL: interaction.guild?.iconURL() ?? undefined,
      })
      .setDescription(formatEngineUser(member.user))
      .setThumbnail(target.displayAvatarURL())
      .setColor(Colors.Gold)
      .addFields(
        {
          name: "Role",
          value: engineStatusLabel(member.role),
          inline: true,
        },
        {
          name: "Member since",
          value: `<t:${Math.floor(Date.parse(member.joinedAt) / 1000)}:D>`,
          inline: true,
        },
        {
          name: "Points",
          value: `${stats.points}${stats.rank ? ` (#${stats.rank})` : ""}`,
          inline: true,
        },
        {
          name: "Events",
          value: `${stats.eventsCompleted} completed · ${stats.eventsLed} led`,
          inline: true,
        },
      )
      .setFooter({
        text: `${member.user.isClaimed ? "Signed in on the web" : "Not signed in on the web yet"} · User ID: ${member.user.id}`,
      });
    if (stats.tiers.current.length > 0) {
      embed.addFields({
        name: "Tiers",
        value: stats.tiers.current.map((tier) => tier.name).join(", "),
      });
    }
    await interaction.editReply({ embeds: [embed] });
  },
);

export const engineListHandlers = {
  list: handleList,
  search: handleSearch,
};

export const engineUserExtraHandlers = {
  events: handleUserEvents,
  info: handleUserInfo,
};
