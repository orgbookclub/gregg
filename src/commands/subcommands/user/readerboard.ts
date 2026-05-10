import { EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  userMention,
} from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { calculateReaderboardScores } from "../../../utils/eventUtils";
import { PaginationManagerV2 } from "../../../utils/paginationManagerV2";

type ReaderboardRow = [string, [number, number]];

const MEDAL_BY_POSITION: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

/**
 * Gets the server reading leaderboard.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleReaderboard: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const response = await bot.api.events.eventsControllerFind({
      status: EventDtoStatusEnum.Completed,
    });

    const eventDocs = response.data;
    if (eventDocs.length === 0) {
      await interaction.editReply(errors.NoEventsForUserError);
      return;
    }
    const scores = calculateReaderboardScores(eventDocs);

    const pageSize = 10;
    const pagedContentManager = new PaginationManagerV2<ReaderboardRow>(
      pageSize,
      scores,
      bot,
      getReaderboardContainer,
      `Server Readerboard`,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > user > readerboard",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function getReaderboardContainer(
  title: string,
  data: ReaderboardRow[],
  interaction: ChatInputCommandInteraction,
  pageInfo: { current: number; total: number },
) {
  const container = new ContainerBuilder().setAccentColor(Colors.DarkGold);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${title}`),
  );
  container.addSeparatorComponents(
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small),
  );

  data.forEach(([discordId, [position, points]]) => {
    const medal = MEDAL_BY_POSITION[position] ?? `\`#${position}\``;
    const line = `${medal} ${userMention(discordId)} — **${points}** pts`;

    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(line))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`usr-stats-${discordId}`)
          .setLabel("Stats")
          .setEmoji({ name: "📊" })
          .setStyle(ButtonStyle.Secondary),
      );

    container.addSectionComponents(section);
  });

  const guildName = interaction.inGuild()
    ? (interaction.guild?.name ?? "Unknown Guild")
    : "";
  const pageStr = `Page ${pageInfo.current} of ${pageInfo.total}`;
  const footerParts = [guildName, pageStr].filter((s) => s.length > 0);
  container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${footerParts.join(" · ")}`),
    );

  return container;
}

export { handleReaderboard };
