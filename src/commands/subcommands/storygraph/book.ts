import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { StorygraphBookDto } from "../../../providers/ows/dto/storygraph-book.dto";
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
    const query = interaction.options.getString("query") ?? "";
    const data = await bot.apiClient.getStorygraphBook(query);
    const embed = getStorygraphBookEmbed(data, bot);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(`Error in handleBook: ${err}`);
  }
};
