import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
} from "@discordjs/builders";
import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  TextInputStyle,
} from "discord.js";

import { CommandHandler, Bot } from "../../../models";
import { logger } from "../../../utils/logHandler";

const EVENT_BROADCAST_MODAL_ID = "eventBroadcastModal";
const MESSAGE_FIELD_ID = "message";

/**
 * Broadcasts a message to all readers of an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleBroadcast: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const id = interaction.options.getString("id", true);
    const modal = getBroadcastModal(id);
    await interaction.showModal(modal);
    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === EVENT_BROADCAST_MODAL_ID;
    const modalSubmitInteraction = await interaction.awaitModalSubmit({
      filter,
      time: 5 * 60 * 1000,
      // 5 minutes until the modal times out
    });
    const messageContent =
      modalSubmitInteraction.fields.getTextInputValue(MESSAGE_FIELD_ID);

    // TODO: Validate the id is of a valid event.

    bot.emit("eventBroadcast", { id: id, content: messageContent });
    await modalSubmitInteraction.reply({
      content: "Your broadcast request has been submitted!",
      ephemeral: true,
    });
  } catch (err) {
    logger.error(err, `Error in handleBroadcast`);
  }
};

function getBroadcastModal(id: string) {
  const modal = new ModalBuilder()
    .setCustomId(EVENT_BROADCAST_MODAL_ID)
    .setTitle(`Event Broadcast: ${id}`);
  const messageInput = new TextInputBuilder()
    .setCustomId(MESSAGE_FIELD_ID)
    .setLabel("What message t?")
    .setPlaceholder("sadfsdfasd")
    .setStyle(TextInputStyle.Paragraph);
  const messageRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      messageInput,
    );
  modal.addComponents(messageRow);
  return modal;
}

export { handleBroadcast };
