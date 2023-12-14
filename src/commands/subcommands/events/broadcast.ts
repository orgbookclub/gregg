import { EventDocument } from "@orgbookclub/ows-client";
import {
  ModalSubmitInteraction,
  TextInputStyle,
  ChannelType,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  GuildMember,
  EmbedBuilder,
  Colors,
  userMention,
  DiscordjsError,
  channelMention,
} from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { logToWebhook } from "../../../utils/logHandler";
import { getUserMentionString, hasRole } from "../../../utils/userUtils";

const EVENT_BROADCAST_MODAL_ID = "eventBroadcastModal";
const MESSAGE_FIELD_ID = "message";

/**
 * Broadcasts a message to all readers of an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleBroadcast: CommandHandler = async (
  bot,
  interaction,
  guildConfig,
) => {
  try {
    if (
      guildConfig &&
      interaction.member &&
      !hasRole(interaction.member as GuildMember, guildConfig.brLeaderRole) &&
      !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
    ) {
      await interaction.reply({
        content: errors.BRLeaderRestrictionError,
        ephemeral: true,
      });
      return;
    }
    const eventId = interaction.options.getString("id", true);
    const channel =
      interaction.options.getChannel<ChannelType.GuildText>("channel");
    if (channel && !channel.isTextBased()) {
      await interaction.reply("Invalid channel!");
      return;
    }

    // Create and show modal
    const salt = Math.random() * 100;
    const modal = getBroadcastModal(eventId, salt);
    await interaction.showModal(modal);

    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === EVENT_BROADCAST_MODAL_ID + salt;
    const modalSubmitInteraction = await interaction.awaitModalSubmit({
      filter,
      time: 5 * 60 * 1000,
    });
    const messageContent =
      modalSubmitInteraction.fields.getTextInputValue(MESSAGE_FIELD_ID);

    // Get event details
    let eventDoc: EventDocument;
    try {
      const response = await bot.api.events.eventsControllerFindOne({
        id: eventId,
      });
      eventDoc = response.data;
    } catch (error) {
      await modalSubmitInteraction.reply({
        content: errors.InvalidEventIdError,
        ephemeral: true,
      });
      return;
    }

    let threadToPost;
    if (!channel) {
      if (eventDoc.threads === undefined || eventDoc.threads.length === 0) {
        await interaction.followUp(
          "Sorry, this event doesn't have any threads listed. Please try manually giving the channel as input",
        );
        return;
      }
      const threadId = eventDoc.threads[0];
      const eventThreadChannel = await bot.channels.fetch(threadId);
      if (!eventThreadChannel?.isTextBased()) {
        await interaction.followUp(
          "Configured channel in event is not a valid text channel! Please try manually giving the channel as input",
        );
        return;
      }
      threadToPost = eventThreadChannel;
    } else {
      threadToPost = channel;
    }

    const mentionString = getUserMentionString(eventDoc.interested, false);
    if (mentionString.length !== 0) {
      await threadToPost.send({ content: mentionString });
    }
    if (messageContent.length !== 0) {
      const message = await threadToPost.send({ content: messageContent });
      await message.pin();
    }

    await modalSubmitInteraction.reply({
      content: `Your message has been broadcasted!`,
      ephemeral: true,
    });

    if (guildConfig) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTimestamp()
        .setTitle("Event Broadcast")
        .setDescription(
          `${userMention(interaction.user.id)} broadcasted message for event ${
            eventDoc._id
          } in ${channelMention(interaction.channelId)}`,
        );
      await logToWebhook({ embeds: [embed] }, guildConfig.logWebhookUrl);
    }
  } catch (err) {
    if (err instanceof DiscordjsError) {
      await interaction.followUp({
        ephemeral: true,
        content:
          "Your request timed out! Please try again and submit the form within 5 minutes",
      });
    } else {
      await interaction.followUp(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > events > broadcast",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

function getBroadcastModal(id: string, salt: number) {
  const modal = new ModalBuilder()
    .setCustomId(EVENT_BROADCAST_MODAL_ID + salt)
    .setTitle(`Event Broadcast: ${id}`);
  const messageInput = new TextInputBuilder()
    .setCustomId(MESSAGE_FIELD_ID)
    .setLabel("What message would you like to send?")
    .setPlaceholder(
      "Write a message to make the bot send it along with the pings." +
        " Note that there is a 2000 character limit. " +
        "If you need to send a longer message, or need to attach images, " +
        "please leave this empty use the bot to ping, and then later send the message yourself.",
    )
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(2000)
    .setRequired(false);
  const messageRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      messageInput,
    );
  modal.addComponents(messageRow);
  return modal;
}

export { handleBroadcast };
