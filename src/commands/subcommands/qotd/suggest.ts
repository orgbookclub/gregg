import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  ComponentType,
  EmbedBuilder,
  TextChannel,
  User,
} from "discord.js";

import { ChannelIds } from "../../../config";
import { Bot, CommandHandler } from "../../../models";
import { logger } from "../../../utils/logHandler";

/**
 * Adds a QOTD suggestion.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleSuggest: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const question = interaction.options.getString("question", true);

    const channelId = ChannelIds.QotdSuggestionChannel;
    const channel = await bot.channels.fetch(channelId);

    if (channel === null || !channel.isTextBased()) {
      throw new Error(
        "Unable to post qotd suggestion in the configured channel",
      );
    }
    const embed = getQotdSuggestionEmbed(question, interaction.user);

    const approveId = "approve";
    const rejectId = "reject";
    const buttonActionRow = getButtonActionRow(approveId, rejectId);

    const message = await (channel as TextChannel).send({
      embeds: [embed],
      components: [buttonActionRow],
    });

    const buttonCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
    });

    buttonCollector.on("collect", async (i) => {
      if (i.customId === approveId) {
        bot.db.qotds.create({
          data: {
            question: question,
            status: "Approved",
            serverId: interaction.guild?.id ?? "",
            userId: interaction.user.id,
            suggestedOn: new Date(),
          },
        });
        await i.update({
          content: "Approved",
          embeds: [embed],
          components: [],
        });
      } else if (i.customId === rejectId) {
        await i.update({
          content: "Rejected",
          embeds: [embed],
          components: [],
        });
      }
    });

    await interaction.reply({
      ephemeral: true,
      content: "Your suggestion has been submitted!",
    });
  } catch (err) {
    logger.error(err, "Error in handleSuggest");
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
