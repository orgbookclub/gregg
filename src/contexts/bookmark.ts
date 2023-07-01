import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  EmbedBuilder,
  Message,
  NewsChannel,
  PrivateThreadChannel,
  PublicThreadChannel,
  TextChannel,
  User,
} from "discord.js";

import { Bot } from "../models/Bot";
import { Context } from "../models/Context";
import { logger } from "../utils/logHandler";

function createBookmarkEmbed(
  author: User,
  message: Message<boolean>,
  guild: string,
  channel:
    | NewsChannel
    | TextChannel
    | PublicThreadChannel
    | PrivateThreadChannel,
) {
  const bookmarkEmbed = new EmbedBuilder();
  bookmarkEmbed.setAuthor({
    name: author.tag,
    iconURL: author.displayAvatarURL(),
  });
  bookmarkEmbed.setDescription(message.content);
  bookmarkEmbed.addFields([
    {
      name: "Guild",
      value: guild,
      inline: true,
    },
    {
      name: "Channel",
      value: channel.name,
      inline: true,
    },
  ]);
  bookmarkEmbed.setTimestamp(message.createdAt);
  return bookmarkEmbed;
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

export const bookmark: Context = {
  data: new ContextMenuCommandBuilder()
    .setName("Bookmark")
    .setType(ApplicationCommandType.Message),
  run: async (bot: Bot, interaction: ContextMenuCommandInteraction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const message = interaction.options.getMessage("message") as Message;
      const channel = interaction.channel as
        | TextChannel
        | PublicThreadChannel
        | NewsChannel
        | PrivateThreadChannel;
      const guild = interaction.guild?.name;

      if (!message || !channel || !guild) {
        await interaction.editReply("Bookmarking failed!");
        return;
      }

      const author = message.author as User;

      const bookmarkEmbed = createBookmarkEmbed(
        author,
        message,
        guild,
        channel,
      );

      const row = createDeleteBookmarkComponent();

      await interaction.user
        .send({
          embeds: [bookmarkEmbed],
          components: [row],
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
