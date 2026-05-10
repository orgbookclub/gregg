import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  EmbedBuilder,
  Message,
  MessageFlags,
  time,
} from "discord.js";

import { errors, messages, templates } from "../config/constants";
import { Context, Bot } from "../models";
import { errorHandler } from "../utils/errorHandler";
import { customSubstring } from "../utils/stringUtils";

const bookmark: Context = {
  data: new ContextMenuCommandBuilder()
    .setName("Bookmark")
    .setType(ApplicationCommandType.Message),
  run: async (bot: Bot, interaction: ContextMenuCommandInteraction) => {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (!interaction.isMessageContextMenuCommand()) {
        await interaction.editReply(errors.SomethingWentWrongShortError);
        return;
      }
      const message = interaction.targetMessage;
      const channel = interaction.channel;
      const guild = interaction.guild;

      if (!message || !channel || !guild || !channel.isTextBased()) {
        await interaction.editReply(errors.BookmarkFailedError);
        return;
      }

      const bookmarkEmbed = createBookmarkEmbed(message);
      const buttonRow = createDeleteBookmarkComponent();

      await interaction.user
        .send({
          content: templates.bookmarkCreated(
            `${time(new Date())}`,
            message.url,
          ),
          embeds: [bookmarkEmbed, ...message.embeds],
          components: [buttonRow],
        })
        .then(async () => {
          await interaction.editReply(messages.BookmarkCreated);
        })
        .catch(async () => {
          await interaction.editReply(errors.BookmarkDmsDisabledError);
        });
    } catch (err) {
      await await errorHandler(
        bot,
        "contexts > bookmark",
        err,
        interaction.guild?.name,
        interaction.isMessageContextMenuCommand()
          ? interaction.targetMessage
          : undefined,
        interaction,
      );
    }
  },
};

function createBookmarkEmbed(message: Message<boolean>) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
    })
    .setColor(Colors.Red);
  if (message.content) {
    embed.addFields([
      {
        name: "Message",
        value: customSubstring(message.content, 1000),
        inline: false,
      },
    ]);
  }
  message.attachments.forEach((attachment) => {
    embed.addFields([
      {
        name: "Attachment",
        value: attachment.url,
        inline: false,
      },
    ]);
    if (attachment.contentType?.includes("image")) {
      embed.setImage(attachment.url);
    }
  });
  embed.setTimestamp(message.createdAt);
  return embed;
}

function createDeleteBookmarkComponent() {
  const deleteButton = new ButtonBuilder()
    .setCustomId("bookmark-delete")
    .setLabel("Delete")
    .setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
    deleteButton,
  ]);
  return row;
}

export { bookmark };
