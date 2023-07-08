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
  time,
} from "discord.js";

import { Context, Bot } from "../models";
import { errorHandler } from "../utils/errorHandler";

const bookmark: Context = {
  data: new ContextMenuCommandBuilder()
    .setName("Bookmark")
    .setType(ApplicationCommandType.Message),
  run: async (bot: Bot, interaction: ContextMenuCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      if (!interaction.isMessageContextMenuCommand()) {
        await interaction.editReply("Something went wrong!");
        return;
      }
      const message = interaction.targetMessage;
      const channel = interaction.channel;
      const guild = interaction.guild;

      if (!message || !channel || !guild || !channel.isTextBased()) {
        await interaction.editReply("Bookmarking failed!");
        return;
      }

      const bookmarkEmbed = createBookmarkEmbed(message);
      const buttonRow = createDeleteBookmarkComponent();

      await interaction.user
        .send({
          content: `Bookmark created: ${`${time(new Date())}`}\n${message.url}`,
          embeds: [bookmarkEmbed, ...message.embeds],
          components: [buttonRow],
        })
        .then(async () => {
          await interaction.editReply("Message has been bookmarked!");
        })
        .catch(async () => {
          await interaction.editReply(
            "Unable to bookmark! Please make sure you have settings configured to enable DMs",
          );
        });
    } catch (err) {
      await errorHandler(
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
        value: message.content,
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
