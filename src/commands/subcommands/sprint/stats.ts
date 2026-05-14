import { sprints } from "@prisma/client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models/commands/CommandHandler";
import { SprintStats } from "../../../models/commands/sprint/SprintStats";
import {
  DateWindow,
  formatWindowTitle,
  resolveDateWindow,
  toPrismaDateRange,
} from "../../../utils/dateWindow";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Gets the total sprint status of a user.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleStats: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();

    const user = interaction.options.getUser("user") ?? interaction.user;

    const resolved = resolveDateWindow(interaction);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }
    const window = resolved.window;
    const range = toPrismaDateRange(window);

    const userSprints = await bot.db.sprints.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
          },
        },
        ...(range ? { endedOn: range } : {}),
      },
    });
    if (userSprints.length === 0) {
      await interaction.editReply(
        `No sprints found for given user${range ? ` in ${window.label}` : ""}`,
      );
      return;
    }
    const stats: SprintStats = calculateSprintStats(user.id, userSprints);
    const embed = getSprintStatsEmbed(user, interaction, stats, window);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > sprint > stats",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function calculateSprintStats(userId: string, sprintDocs: sprints[]) {
  const finishedSprints = sprintDocs.filter((x) =>
    x.participants.some((y) => y.userId === userId && y.didFinish),
  );
  let finishedDuration = 0;
  let pageCount = 0;
  for (const sprint of finishedSprints) {
    finishedDuration += sprint.duration;
    const participant = sprint.participants.find(
      (x) => x.userId === userId && x.didFinish,
    );
    if (!participant) continue;
    pageCount += Math.max(0, participant.endCount - participant.startCount);
  }

  return {
    participatedCount: sprintDocs.length,
    finishedCount: finishedSprints.length,
    finishedDuration: finishedDuration,
    pageCount: pageCount,
    avgSpeed: (pageCount / finishedDuration).toFixed(2),
    avgDuration: (finishedDuration / finishedSprints.length).toFixed(2),
  };
}

function getSprintStatsEmbed(
  user: User,
  interaction: ChatInputCommandInteraction,
  stats: SprintStats,
  window: DateWindow,
) {
  const embed = new EmbedBuilder()
    .setTitle(formatWindowTitle(`${user.username} | Sprint Stats`, window))
    .setAuthor({
      name: interaction.guild?.name ?? "Guild Name Unavailable",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    })
    .setThumbnail(user.displayAvatarURL() ?? user.defaultAvatarURL)
    .setColor(Colors.Gold);
  const description =
    `> Participated in ${stats.participatedCount} sprints` +
    `\n> ${stats.pageCount} pages read from ${stats.finishedCount} sprints in  ${stats.finishedDuration} minute(s) ` +
    `\n> Average speed was ${stats.avgSpeed} pages/minute and Average duration was ${stats.avgDuration} minute(s)`;
  embed.setDescription(description);
  return embed;
}

export { handleStats };
