import {
  EventDocument,
  EventDtoStatusEnum,
} from "@organizedbookclub/ows-client";
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { errors } from "../../../config/constants";
import { Bot, CommandHandler } from "../../../models";
import { Stats } from "../../../models/commands/events/Stats";
import { UserEventStats } from "../../../models/commands/events/UserEventStats";
import { errorHandler } from "../../../utils/errorHandler";
import { USER_STATS_FIELDS, findAllEvents } from "../../../utils/eventsApi";

/**
 * Gets the server event stats for a user.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleStats: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const user = interaction.options.getUser("user", false) ?? interaction.user;

    const result = await buildUserEventStatsEmbed(bot, user, interaction);
    if (typeof result === "string") {
      await interaction.editReply(result);
      return;
    }
    await interaction.editReply({ embeds: [result] });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > stats",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function calculateUserEventStats(id: string, eventDocs: EventDocument[]) {
  const userEventStats: UserEventStats = {
    totalScore: 0,
    stats: {},
  };
  for (const event of eventDocs) {
    const eventType = event.type;
    const readerPoints =
      event.readers.find((x) => x.user._id === id)?.points ?? 0;
    const leaderPoints =
      event.leaders.find((x) => x.user._id === id)?.points ?? 0;

    if (userEventStats.stats[eventType] === undefined) {
      userEventStats.stats[eventType] = {
        totalNumberOfEvents: 0,
        interestedInCount: 0,
        requestedCount: 0,
        leadCount: 0,
        readCount: 0,
        readerPoints: 0,
        leaderPoints: 0,
      };
    }
    userEventStats.stats[eventType].totalNumberOfEvents += 1;
    if (event.interested.find((x) => x.user._id === id)) {
      userEventStats.stats[eventType].interestedInCount += 1;
    }
    if (event.requestedBy && event.requestedBy.user._id === id) {
      userEventStats.stats[eventType].requestedCount += 1;
    }
    if (event.leaders.find((x) => x.user._id === id)) {
      userEventStats.stats[eventType].leadCount += 1;
    }
    if (event.readers.find((x) => x.user._id === id)) {
      userEventStats.stats[eventType].readCount += 1;
    }
    if (event.status === EventDtoStatusEnum.Completed) {
      userEventStats.stats[eventType].readerPoints += readerPoints;
      userEventStats.stats[eventType].leaderPoints += leaderPoints;
      userEventStats.totalScore += readerPoints + leaderPoints;
    }
  }
  return userEventStats;
}

function getUserEventStatsEmbed(
  userEventStats: UserEventStats,
  id: string,
  user: User,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${user.username} | Event Stats`)
    .setAuthor({
      name: interaction.guild?.name ?? "Guild Name Unavailable",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    })
    .setDescription(`Total score: ${userEventStats.totalScore}`)
    .setThumbnail(user.displayAvatarURL() ?? user.defaultAvatarURL)
    .setColor(Colors.Gold)
    .setFooter({ text: `User ID: ${id}` });
  for (const eventType of Object.keys(userEventStats.stats)) {
    const stats = userEventStats.stats[eventType];
    embed.addFields({
      name: `${eventType} (${stats.readerPoints + stats.leaderPoints})`,
      value: getValueStringForField(stats),
      inline: true,
    });
  }
  return embed;

  function getValueStringForField(stats: Stats): string {
    return (
      `> ${stats.readerPoints} reader points from ${stats.readCount} events` +
      `\n> ${stats.leaderPoints} leader points from ${stats.leadCount} events` +
      `\n> Was interested in ${stats.interestedInCount} events` +
      `\n> Requested ${stats.requestedCount} events`
    );
  }
}

/**
 * Builds the user event stats embed for the given Discord user, or returns an
 * error string if no user/events found. Shared by the slash command and the
 * Stats button on `/user readerboard`.
 *
 * @param bot The bot instance.
 * @param user The Discord user.
 * @param interaction The interaction (used for guild metadata in the embed).
 * @returns The stats embed, or a user-facing error message.
 */
async function buildUserEventStatsEmbed(
  bot: Bot,
  user: User,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<EmbedBuilder | string> {
  const userResponse = await bot.api.users.usersControllerFindOneByUserId({
    userid: user.id,
  });
  if (!userResponse) {
    return `No user found! Please check if the user ID ${user.id} is registered with the bot`;
  }
  const userId = userResponse.data._id;
  const eventDocs = await findAllEvents(
    bot,
    { participantIds: [userId] },
    USER_STATS_FIELDS,
  );
  if (eventDocs.length === 0) {
    return "No events found for given user";
  }
  const stats = calculateUserEventStats(userId, eventDocs);
  return getUserEventStatsEmbed(stats, userId, user, interaction);
}

export { handleStats, buildUserEventStatsEmbed };
