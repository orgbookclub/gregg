import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  User,
} from "discord.js";

import { CommandHandler } from "../../../models";
import { QotdSuggestion } from "../../../models/commands/qotd/QotdSuggestion";
import { QotdSuggestionStatus } from "../../../models/commands/qotd/QotdSuggestionStatus";
import { getGuildFromDb } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";

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

    if (!interaction.guild) return;
    const guildDoc = await getGuildFromDb(bot, interaction.guild.id);
    const channelId = guildDoc?.qotdSuggestionChannel ?? "Not set";

    const channel = await bot.channels.fetch(channelId);

    if (!channel?.isTextBased()) {
      await interaction.editReply(
        "Something went wrong while trying to log the question in the channel. Please contact staff",
      );
      throw new Error(`Unable to find qotd text channel/thread`);
    }
    if (!interaction.guild) return;

    const qotdSuggestion: QotdSuggestion = {
      question: question,
      status: QotdSuggestionStatus.Requested,
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      createdOn: new Date(),
    };
    const qotdSuggestionDoc = await bot.db.qotds.create({
      data: { ...qotdSuggestion, updatedOn: qotdSuggestion.createdOn },
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
    await interaction.editReply("Something went wrong! Please try again later");
    errorHandler(
      bot,
      "commands > qotd > suggest",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
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
