import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { ChannelIds } from "../../../config";
import { CommandHandler } from "../../../models";
import { QotdSuggestion } from "../../../models/commands/qotd/QotdSuggestion";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { logger } from "../../../utils/logHandler";

/**
 * Adds a QOTD suggestion.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleSuggest: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply({ ephemeral: true });
    const question = interaction.options.getString("question", true);

    const channelId = ChannelIds.QotdSuggestionChannel;
    const channel = await bot.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
      logger.error(
        { threadId: channel },
        `Unable to find qotd text channel/thread`,
      );
      await interaction.editReply(
        "Something went wrong while trying to log the question in the channel. Please contact staff",
      );
      return;
    }
    if (!interaction.guild) return;

    const qotdSuggestion: QotdSuggestion = {
      question: question,
      status: QotdSuggestionStatus.Requested,
      serverId: interaction.guild.id,
      userId: interaction.user.id,
      suggestedOn: new Date(),
    };
    const qotdSuggestionDoc = await bot.db.qotds.create({
      data: qotdSuggestion,
    });
    const id = qotdSuggestionDoc.id;
    const embed = getQotdSuggestionEmbed(question, interaction.user);
    const buttonActionRow = getButtonActionRow(
      `qs-${id}-approve`,
      `qs-${id}-reject`,
    );

    await channel.send({
      embeds: [embed],
      components: [buttonActionRow],
    });
    await interaction.editReply({
      content: "Your suggestion has been submitted!",
    });
  } catch (err) {
    logger.error(err, "Error in handleSuggest");
    await interaction.editReply("Something went wrong! Please try again later");
  }
};

function getButtonActionRow(approveId: string, rejectId: string) {
  const approveButton = new ButtonBuilder()
    .setEmoji({ name: "✅" })
    .setStyle(ButtonStyle.Success)
    .setCustomId(approveId);
  const rejectButton = new ButtonBuilder()
    .setEmoji({ name: "❌" })
    .setStyle(ButtonStyle.Secondary)
    .setCustomId(rejectId);
  const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    approveButton,
    rejectButton,
  );
  return buttonActionRow;
}

function getQotdSuggestionEmbed(question: string, author: User) {
  const embed = new EmbedBuilder();
  embed
    .setTitle("QOTD Suggestion")
    .setAuthor({
      name: author.username,
      iconURL: author.displayAvatarURL(),
    })
    .setColor(Colors.Blurple)
    .setDescription(question);
  return embed;
}

export { handleSuggest };
