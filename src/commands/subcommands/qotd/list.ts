import { qotds } from "@prisma/client";
import {
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  GuildMember,
  time,
  userMention,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { errorHandler } from "../../../utils/errorHandler";
import { PaginationManager } from "../../../utils/paginationManager";
import { hasRole } from "../../../utils/userUtils";

/**
 * Lists the available qotds.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleList: CommandHandler = async (bot, interaction, guildConfig) => {
  try {
    if (
      guildConfig &&
      interaction.member &&
      !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
    ) {
      await interaction.reply({
        content: "Sorry, this command is restricted for staff use only!",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const approvedQotdList: qotds[] = await bot.db.qotds.findMany({
      where: {
        status: QotdSuggestionStatus.Approved,
      },
    });
    if (approvedQotdList.length === 0) {
      await interaction.editReply("There are no available Qotds");
      return;
    }
    const pageSize = 7;
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
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > qotd > list",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
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
      value:
        `> __ID__: \`${doc.id}\`` +
        "\n" +
        `> __By__: ${userMention(doc.userId)}` +
        ` | __On__: ${time(doc.createdOn)}`,
      inline: false,
    });
  });
  return embed;
}
export { handleList };
