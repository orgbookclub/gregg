import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
} from "@discordjs/builders";
import { EventDtoStatusEnum, UpdateEventDto } from "@orgbookclub/ows-client";
import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  TextInputStyle,
} from "discord.js";

import { Bot } from "../../../interfaces/Bot";
import { CommandHandler } from "../../../interfaces/CommandHandler";
import { logger } from "../../../utils/logHandler";

const EVENT_EDIT_MODAL_ID = "eventEditModal";
const STATUS_FIELD_ID = "status";
const START_DATE_FIELD_ID = "startDate";
const END_DATE_FIELD_ID = "endDate";

function getEventEditModal(eventId: string) {
  const modal = new ModalBuilder()
    .setCustomId(`${EVENT_EDIT_MODAL_ID}`)
    .setTitle(`Editing Event: ${eventId}`);
  const statusInput = new TextInputBuilder()
    .setCustomId(STATUS_FIELD_ID)
    .setLabel("What should be the status of the event?")
    .setPlaceholder("Approved")
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  const statusRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      statusInput,
    );
  modal.addComponents(statusRow);

  const startDateInput = new TextInputBuilder()
    .setCustomId(START_DATE_FIELD_ID)
    .setLabel("When do you want the event to start?")
    .setPlaceholder("YYYY-MM-DD")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
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
    .setPlaceholder("YYYY-MM-DD")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10)
    .setMinLength(10);

  const endDateRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      endDateInput,
    );
  modal.addComponents(endDateRow);
  return modal;
}

function extractFieldsFromModalSubmission(
  modalSubmitInteraction: ModalSubmitInteraction,
) {
  const statusString =
    modalSubmitInteraction.fields.getTextInputValue(STATUS_FIELD_ID);
  const startDateString =
    modalSubmitInteraction.fields.getTextInputValue(START_DATE_FIELD_ID);
  const endDateString =
    modalSubmitInteraction.fields.getTextInputValue(END_DATE_FIELD_ID);
  return { statusString, startDateString, endDateString };
}

function validateModalSubmission(modalSubmissions: {
  statusString: string;
  startDateString: string;
  endDateString: string;
}) {
  const res: {
    statusEnum: EventDtoStatusEnum;
    startDate: Date;
    endDate: Date;
  } = {
    statusEnum: "Requested",
    startDate: new Date(),
    endDate: new Date(),
  };
  const statusEnum = getStatusEnum();
  res.statusEnum = statusEnum;
  const startDate = getStartDate();
  res.startDate = startDate;
  const endDate = getEndDate();
  res.endDate = endDate;
  return res;

  function getEndDate() {
    const endTimestamp = Date.parse(modalSubmissions.endDateString);
    if (isNaN(endTimestamp)) {
      throw new Error("Invalid end date");
    }
    if (new Date(endTimestamp) < startDate) {
      throw new Error("End date cannot be before the start date!");
    }
    return new Date(endTimestamp);
  }

  function getStartDate() {
    const startTimestamp = Date.parse(modalSubmissions.startDateString);
    if (isNaN(startTimestamp)) {
      throw new Error("Invalid start date");
    }
    return new Date(startTimestamp);
  }

  function getStatusEnum() {
    if (
      !Object.values(EventDtoStatusEnum).includes(
        modalSubmissions.statusString as EventDtoStatusEnum,
      )
    ) {
      throw new Error(
        `Invalid event status. Event status can be one of the folllowing - ${Object.values(
          EventDtoStatusEnum,
        )}`,
      );
    }
    return modalSubmissions.statusString as keyof typeof EventDtoStatusEnum;
  }
}

/**
 *
 * @param {Bot} bot The bot instance.
 * @param {ChatInputCommandInteraction} interaction The interaction.
 */
export const handleEdit: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
  try {
    const id = interaction.options.getString("id", true);
    const modal = getEventEditModal(id);
    await interaction.showModal(modal);
    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === EVENT_EDIT_MODAL_ID;
    const modalSubmitInteraction = await interaction.awaitModalSubmit({
      filter,
      time: 5 * 60 * 1000,
      // 5 minutes until the modal times out
    });

    const modalSubmissions = extractFieldsFromModalSubmission(
      modalSubmitInteraction,
    );

    const validatedModalSubmission = validateModalSubmission(modalSubmissions);
    const updateEventDto: UpdateEventDto = {};
    updateEventDto.status = validatedModalSubmission.statusEnum;
    updateEventDto.dates = {
      startDate: validatedModalSubmission.startDate.toISOString(),
      endDate: validatedModalSubmission.endDate.toISOString(),
    };
    bot.emit("eventEdit", { id: id, updateEventDto: updateEventDto });
    await modalSubmitInteraction.reply({
      content: "Your event edit request has been submitted!",
      ephemeral: true,
    });
  } catch (err) {
    logger.error(`Error in handleEdit ${err}`);
    await interaction.followUp({ content: `${err}`, ephemeral: true });
  }
};
