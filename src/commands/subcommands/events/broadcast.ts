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
} from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
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
        content: errors.StaffRestrictionError,
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
    const modal = getBroadcastModal(eventId);
    await interaction.showModal(modal);

    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === EVENT_BROADCAST_MODAL_ID;
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
      const threadId = eventDoc.threads[0];
      const eventThreadChannel = await bot.channels.fetch(threadId);
      if (!eventThreadChannel?.isTextBased()) {
        await interaction.editReply(
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
      content: "Your message has been broadcasted!",
      ephemeral: true,
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > broadcast",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

function getBroadcastModal(id: string) {
  const modal = new ModalBuilder()
    .setCustomId(EVENT_BROADCAST_MODAL_ID)
    .setTitle(`Event Broadcast: ${id}`);
  const messageInput = new TextInputBuilder()
    .setCustomId(MESSAGE_FIELD_ID)
    .setLabel("What message would you like to send?")
    .setPlaceholder(
      "Write a message to make the bot send it along with the pings",
    )
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);
  const messageRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      messageInput,
    );
  modal.addComponents(messageRow);
  return modal;
}

export { handleBroadcast };
