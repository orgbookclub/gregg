import { EmbedBuilder } from "@discordjs/builders";
import { qotds } from "@prisma/client";
import { ChatInputCommandInteraction, Colors } from "discord.js";

import { Bot, CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";
import { PaginationManager } from "../../../utils/paginationManager";

/**
 * Lists the available qotds.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleList: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const approvedQotdList: qotds[] = await bot.db.qotds.findMany({
      where: {
        status: "Approved",
      },
    });
    if (approvedQotdList.length === 0) {
      await interaction.reply("There are no available Qotds");
      return;
    }
    const pageSize = 10;
    const pagedContentManager = new PaginationManager<qotds>(
      pageSize,
      approvedQotdList,
      bot,
      getQotdListEmbed,
      `Available QOTDs`,
    );
    const message = await interaction.editReply(
      pagedContentManager.createMessagePayloadForPage(interaction),
    );
    pagedContentManager.createCollectors(message, interaction, 5 * 60 * 1000);
  } catch (err) {
    logger.error(err, "Error in handleList");
  }
};

function getQotdListEmbed(
  title: string,
  qotdList: qotds[],
  interaction: ChatInputCommandInteraction,
) {
  const embed = new EmbedBuilder().setTitle(title).setColor(Colors.Blurple);
  if (interaction.inGuild()) {
    embed.setAuthor({
      name: interaction.guild?.name ?? "Unknown Guild",
      iconURL: interaction.guild?.iconURL() ?? undefined,
    });
  }
  qotdList.forEach((doc) => {
    embed.addFields({
      name: doc.question,
      value: `> ID: \`${doc.id}\``,
      inline: false,
    });
  });
  return embed;
}
export { handleList };
