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
  TextChannel,
  User,
} from "discord.js";

import { Context, Bot } from "../models";
import { getUnixTimestamp } from "../utils/eventUtils";
import { logger } from "../utils/logHandler";

const bookmark: Context = {
  data: new ContextMenuCommandBuilder()
    .setName("Bookmark")
    .setType(ApplicationCommandType.Message),
  run: async (bot: Bot, interaction: ContextMenuCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const message = interaction.options.getMessage("message") as Message;
      const channel = interaction.channel as TextChannel;
      const guild = interaction.guild;

      if (!message || !channel || !guild) {
        await interaction.editReply("Bookmarking failed!");
        return;
      }

      const author = message.author as User;

      const bookmarkEmbed = createBookmarkEmbed(author, message);

      const buttonRow = createDeleteBookmarkComponent();

      await interaction.user
        .send({
          content: `Bookmark created: ${`<t:${getUnixTimestamp(
            new Date(),
          )}>`}\n${message.url}`,
          embeds: [bookmarkEmbed],
          components: [buttonRow],
        })
        .then(async () => {
          await interaction.editReply("Message has been bookmarked!");
        })
        .catch(async () => {
          await interaction.editReply(
            "Unable to bookmark! Please make sure you have settings configured to enable DMs from members of the server",
          );
        });
    } catch (err) {
      logger.error(err, "Error handling bookmark context command");
    }
  },
};

function createBookmarkEmbed(author: User, message: Message<boolean>) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: author.tag,
      iconURL: author.displayAvatarURL(),
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
    .setCustomId("delete-bookmark")
    .setLabel("Delete")
    .setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
    deleteButton,
  ]);
  return row;
}

export { bookmark };
