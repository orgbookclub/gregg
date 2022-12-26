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
import { EventType } from "../../../providers/ows/dto/event-type";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

const EVENT_REQUEST_MODAL_ID = "eventRequestModal";
const BOOK_LINK_FIELD_ID = "link";
const START_DATE_FIELD_ID = "startDate";
const END_DATE_FIELD_ID = "endDate";
const REQUEST_REASON_FIELD_ID = "reason";

function getEventRequestModal(eventType: string) {
  const modal = new ModalBuilder()
    .setCustomId(EVENT_REQUEST_MODAL_ID)
    .setTitle(`${eventType} Request`);
  const linkInput = new TextInputBuilder()
    .setCustomId(BOOK_LINK_FIELD_ID)
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
      .setCustomId(START_DATE_FIELD_ID)
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
      .setCustomId(END_DATE_FIELD_ID)
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
    .setCustomId(REQUEST_REASON_FIELD_ID)
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

function extractFieldsFromModalSubmission(
  modalSubmitInteraction: ModalSubmitInteraction,
) {
  const link =
    modalSubmitInteraction.fields.getTextInputValue(BOOK_LINK_FIELD_ID);
  const startDateString =
    modalSubmitInteraction.fields.getTextInputValue(START_DATE_FIELD_ID);
  const endDateString =
    modalSubmitInteraction.fields.getTextInputValue(END_DATE_FIELD_ID);
  const requestReason = modalSubmitInteraction.fields.getTextInputValue(
    REQUEST_REASON_FIELD_ID,
  );
  return { link, startDateString, endDateString, requestReason };
}

function validateModalSubmission(
  startDateString: string,
  endDateString: string,
  link: string,
) {
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
  return { startDate, endDate };
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
      msInteraction.customId === EVENT_REQUEST_MODAL_ID;
    const modalSubmitInteraction = await interaction.awaitModalSubmit({
      filter,
      time: 5 * 60 * 1000,
      // 5 minutes until the modal times out
    });

    const { link, startDateString, endDateString, requestReason } =
      extractFieldsFromModalSubmission(modalSubmitInteraction);

    const { startDate, endDate } = validateModalSubmission(
      startDateString,
      endDateString,
      link,
    );

    // Perform action on data submitted
    const event = await bot.apiClient.createEvent({
      bookUrl: link,
      type: EventType[eventType as keyof typeof EventType],
      dates: {
        startDate: startDate,
        endDate: endDate,
      },
      requestedBy: "x",
      // TODO: get user id from discord id.
      leaders: ["x"],
      description: requestReason,
    });
    await modalSubmitInteraction.reply({
      content: "Request created!",
      embeds: [getEventInfoEmbed(event, bot, interaction)],
      ephemeral: true,
    });
  } catch (err) {
    await interaction.followUp({ content: `${err}`, ephemeral: true });
    logger.error(`Error in handleRequest ${err}`);
  }
};
