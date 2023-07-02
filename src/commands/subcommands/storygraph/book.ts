import { StorygraphBookDto } from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction, Colors, EmbedBuilder } from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { getAuthorString } from "../../../utils/bookUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Gets the SG book information and returns an embed.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleBook: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const query = interaction.options.getString("query", true);
    const response =
      await bot.api.storygraph.storygraphControllerSearchAndGetBook({
        q: query,
      });
    const embed = getStorygraphBookEmbed(response.data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error(err, `Error in handleBook`);
  }
};

function getStorygraphBookEmbed(data: StorygraphBookDto) {
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
    .setFooter({ text: `Fetched from Storygraph` })
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

export { handleBook };
