import { EventDocument, EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  userMention,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { PaginationManager } from "../../../utils/paginationManager";

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
      await interaction.editReply("No events found, something went wrong! :(");
      return;
    }
    const scores = calculateReaderboardScores(eventDocs);

    const pageSize = 10;
    const pagedContentManager = new PaginationManager<
      [string, [number, number]]
    >(pageSize, scores, bot, getReaderboardEmbed, `Server Readerboard`);
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
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

function calculateReaderboardScores(eventDocs: EventDocument[]) {
  const scoreMap = new Map<string, number>();

  for (const event of eventDocs) {
    for (const participant of event.readers.concat(event.leaders)) {
      const userId = participant.user.userId;
      scoreMap.set(
        userId,
        (scoreMap.get(userId) ?? 0) + (participant.points ?? 0),
      );
    }
  }

  const scores = [...scoreMap.entries()];
  scores.sort((a, b) => b[1] - a[1]);

  let position = 1;
  const scoresWithPosition: [string, [number, number]][] = [];
  for (const score of scores) {
    const [userId, points] = score;
    scoresWithPosition.push([userId, [position, points]]);
    position += 1;
  }

  return scoresWithPosition;
}

function getReaderboardEmbed(
  title: string,
  data: [string, [number, number]][],
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder().setTitle(title).setColor(Colors.DarkGold);
  if (interaction.inGuild()) {
    embed.setAuthor({
      name: interaction.guild?.name ?? "Unknown Guild",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  }
  let descriptionString = "";
  data.forEach((score) => {
    descriptionString += `\`${score[1][0]}\` ${userMention(score[0])} --> **${
      score[1][1]
    }**\n`;
  });
  embed.setDescription(descriptionString);
  return embed;
}

export { handleReaderboard };
