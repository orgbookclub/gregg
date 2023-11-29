import { StorygraphBookDto } from "@orgbookclub/ows-client";
import { Colors, EmbedBuilder } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { getAuthorString } from "../../../utils/bookUtils";
import { errorHandler } from "../../../utils/errorHandler";

/**
 * Fetches details of a book from SG.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleBook: CommandHandler = async (bot, interaction) => {
  try {
    const query = interaction.options.getString("query", true);
    const isEphemeral = interaction.options.getBoolean("ephemeral") ?? true;
    await interaction.deferReply({ ephemeral: isEphemeral });

    const response =
      await bot.api.storygraph.storygraphControllerSearchAndGetBook({
        q: query,
      });

    const embed = getStorygraphBookEmbed(response.data);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    const error = err as Error;
    if (error.message === "Request failed with status code 404") {
      await interaction.editReply(errors.NoBooksFoundError);
    } else {
      await interaction.editReply(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > storygraph > book",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

function getStorygraphBookEmbed(book: StorygraphBookDto) {
  const authorUrl = book.authors[0].url;
  const embed = new EmbedBuilder()
    .setTitle(book.title)
    .setURL(book.url)
    .setAuthor({ name: getAuthorString(book.authors), url: authorUrl })
    .setThumbnail(book.coverUrl)
    .addFields(
      { name: "Rating ⭐", value: `${book.avgRating}`, inline: true },
      { name: "Pages 📄", value: book.numPages.toString(), inline: true },
      {
        name: "Moods 🤔",
        value: `${book.moods.slice(0, 3).join(", ")}`,
        inline: false,
      },
      { name: "Pace 🏃‍♂️", value: `${book.pace.join(", ")}`, inline: true },
    )
    .setFooter({ text: `Fetched from Storygraph` })
    .setColor(Colors.DarkAqua);
  book.quesAns.forEach((element) => {
    embed.addFields({
      name: `🔹 ${element.question}`,
      value: element.answer,
      inline: false,
    });
  });
  return embed;
}

export { handleBook };
