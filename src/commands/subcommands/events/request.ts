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

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { BookDto } from "../../../providers/ows/dto/book.dto";
import { EventType } from "../../../providers/ows/dto/event-type";
import { logger } from "../../../utils/logHandler";

function getEventRequestModal(eventType: string) {
  const modal = new ModalBuilder()
    .setCustomId("eventRequestModal")
    .setTitle(`${eventType} Request`);
  const linkInput = new TextInputBuilder()
    .setCustomId("link")
    .setLabel("What's the GR or SG link to the book?")
    .setRequired(true)
    .setPlaceholder("https://www.goodreads.com/book/show/xxxxyyy-zzzz")
    .setStyle(TextInputStyle.Short);
  const linkActionRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      linkInput,
    );
  modal.addComponents(linkActionRow);

  if (eventType === EventType.BuddyRead) {
    const startDateInput = new TextInputBuilder()
      .setCustomId("startDate")
      .setLabel("When do you want the event to start?")
      .setRequired(true)
      .setPlaceholder("YYYY-MM-DD")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(10)
      .setMinLength(10);

    const startDateRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        startDateInput,
      );
    modal.addComponents(startDateRow);

    const endDateInput = new TextInputBuilder()
      .setCustomId("endDate")
      .setLabel("When do you want the event to end?")
      .setRequired(true)
      .setPlaceholder("YYYY-MM-DD")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(10)
      .setMinLength(10);

    const endDateRow =
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        endDateInput,
      );
    modal.addComponents(endDateRow);
  }
  const reasonInput = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Why are you requesting this book?")
    .setRequired(true)
    .setStyle(TextInputStyle.Paragraph);
  const reasonActionRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      reasonInput,
    );
  modal.addComponents(reasonActionRow);
  return modal;
}

/**
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleRequest: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const eventType = interaction.options.getString("type", true);
    const modal = getEventRequestModal(eventType);
    await interaction.showModal(modal);
    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === "eventRequestModal";
    const modalSubmitInteraction = await interaction.awaitModalSubmit({
      filter,
      time: 5 * 60 * 1000,
      // 5 minutes until the modal times out
    });

    // Extract data from modal submission
    const link = modalSubmitInteraction.fields.getTextInputValue("link");
    const startDateString =
      modalSubmitInteraction.fields.getTextInputValue("startDate");
    const endDateString =
      modalSubmitInteraction.fields.getTextInputValue("endDate");
    const requestReason =
      modalSubmitInteraction.fields.getTextInputValue("reason");

    // validate data from submission
    logger.debug(
      `${link} ${startDateString} ${endDateString} ${requestReason}`,
    );

    const startTimestamp = Date.parse(startDateString);
    if (isNaN(startTimestamp)) {
      throw new Error("Invalid start date");
    }
    const startDate = new Date(startTimestamp);
    if (startDate < new Date()) {
      throw new Error("Start date cannot be in the past!");
    }
    const endTimestamp = Date.parse(endDateString);
    if (isNaN(endTimestamp)) {
      throw new Error("Invalid end date");
    }
    const endDate = new Date(endTimestamp);
    if (endDate < startDate) {
      throw new Error("End date cannot be before the start date!");
    }
    if (!link.includes("goodreads.com/") && !link.includes("storygraph.com/")) {
      throw new Error("Invalid link!");
    }

    // Perform action on data submitted
    await bot.apiClient.createEvent({
      bookUrl: link,
      dates: {
        startDate: startDate,
        endDate: endDate,
      },
      description: requestReason,
    });
  } catch (err) {
    await interaction.followUp({ content: `${err}` });
    logger.error(`Error in handleRequest ${err}`);
  }
};
