import { StorygraphBookDto } from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { Bot } from "../../../models/Bot";
import { CommandHandler } from "../../../models/CommandHandler";
import { getAuthorString } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";

function getStorygraphBookEmbed(data: StorygraphBookDto, bot: Bot) {
  const authorUrl = data.authors[0].url;
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setURL(data.url)
    .setAuthor({ name: getAuthorString(data.authors), url: authorUrl })
    .setThumbnail(data.coverUrl)
    .addFields(
      { name: "Rating ⭐", value: `${data.avgRating}`, inline: true },
      {
        name: "Moods 🤔",
        value: `${data.moods.slice(0, 3).join(", ")}`,
        inline: true,
      },
      { name: "Pace 🏃‍♂️", value: `${data.pace.join(", ")}`, inline: true },
    )
    .setFooter({ text: `Fetched from Goodreads by ${bot.user?.username}` })
    .setColor(Colors.DarkAqua);
  data.quesAns.forEach((element) => {
    embed.addFields({
      name: `🔹 ${element.question}`,
      value: element.answer,
      inline: false,
    });
  });
  return embed;
}

/**
 * Gets the SG book information and returns an embed.
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleBook: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const response =
      await bot.api.storygraph.storygraphControllerSearchAndGetBook({
        q: query,
      });
    const embed = getStorygraphBookEmbed(response.data, bot);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleBook: ${err}`);
  }
};
