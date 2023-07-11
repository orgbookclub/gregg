import { EventDocument, EventDtoStatusEnum } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { Stats } from "../../../models/commands/events/Stats";
import { UserEventStats } from "../../../models/commands/events/UserEventStats";
import { errorHandler } from "../../../utils/errorHandler";

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

    const userResponse = await bot.api.users.usersControllerFindOneByUserId({
      userid: user.id,
    });
    if (!userResponse) {
      await interaction.editReply(
        `No user found! Please check if the user ID ${user.id} is registered with the bot`,
      );
      return;
    }

    const userId = userResponse.data._id;
    const userEventsResponse = await bot.api.events.eventsControllerFind({
      participantIds: [userId],
    });
    if (!userEventsResponse || userEventsResponse.data.length === 0) {
      await interaction.editReply("No events found for given user");
      return;
    }

    const userEventDocs = userEventsResponse.data;
    const stats = calculateUserEventStats(userId, userEventDocs);
    const embed = getUserEventStatsEmbed(stats, userId, user, interaction);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
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
  interaction: ChatInputCommandInteraction,
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

export { handleStats };
