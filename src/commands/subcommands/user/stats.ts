import { EventDocument, EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

interface Stats {
  totalNumberOfEvents: number;
  interestedInCount: number;
  requestedCount: number;
  leadCount: number;
  readCount: number;
  readerPoints: number;
  leaderPoints: number;
}

type UserEventStats = {
  totalScore: number;
  stats: { [key: string]: Stats };
};

function calculateUserEventStats(id: string, events: EventDocument[]) {
  const userEventStats: UserEventStats = {
    totalScore: 0,
    stats: {},
  };
  for (const event of events) {
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
    if (event.requestedBy.user._id === id) {
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
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder()
    .setTitle(`${user.username}#${user.discriminator}`)
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
 * Gets the server event stats for a user.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleStats: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    await interaction.deferReply();
    const user = interaction.options.getUser("user") ?? interaction.user;
    const userResponse = await bot.api.users.usersControllerFindOneByUserId({
      userid: user.id,
    });
    const userDto = userResponse.data;
    const userEventsResponse = await bot.api.events.eventsControllerFind({
      participantIds: [userDto._id],
    });
    const userEvents = userEventsResponse.data;
    const stats = calculateUserEventStats(userDto._id, userEvents);
    const embed = getUserEventStatsEmbed(stats, userDto._id, user, interaction);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleStats ${err}`);
  }
};
