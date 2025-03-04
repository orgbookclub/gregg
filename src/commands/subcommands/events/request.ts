import {
  CreateEventDto,
  EventDocumentTypeEnum,
  EventDtoTypeEnum,
} from "@orgbookclub/ows-client";
import {
  ActionRowBuilder,
  DiscordjsError,
  GuildMember,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { errors } from "../../../config/constants";
import { Bot, CommandHandler } from "../../../models";
import { EventRequestSubmission } from "../../../models/commands/events/EventRequestSubmission";
import { createEventMessageDoc } from "../../../utils/dbUtils";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventRequestEmbed,
  getNextMonthRange,
} from "../../../utils/eventUtils";
import { getButtonActionRow } from "../../../utils/messageUtils";
import { hasRole, upsertUser } from "../../../utils/userUtils";

const EVENT_REQUEST_MODAL_ID = "eventRequestModal";
const BOOK_LINK_FIELD_ID = "link";
const START_DATE_FIELD_ID = "startDate";
const END_DATE_FIELD_ID = "endDate";
const REQUEST_REASON_FIELD_ID = "reason";

/**
 * For requesting an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleRequest: CommandHandler = async (bot, interaction, guildConfig) => {
  try {
    if (!guildConfig || !interaction.member) {
      await interaction.reply("You shouldn't be here! :o");
      return;
    }
    const eventType = interaction.options.getString(
      "type",
      true,
    ) as keyof typeof EventDtoTypeEnum;
    const salt = Math.random() * 100;
    const modal = getEventRequestModal(eventType, salt);
    await interaction.showModal(modal);
    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === EVENT_REQUEST_MODAL_ID + salt;
    const modalSubmitInteraction = await interaction.awaitModalSubmit({
      filter,
      time: 5 * 60 * 1000,
    });
    await modalSubmitInteraction.deferReply({ ephemeral: true });

    const submission: EventRequestSubmission = getEventRequestSubmission(
      modalSubmitInteraction,
      eventType,
    );
    const validationResponse = isValidSubmission(
      submission,
      hasRole(
        modalSubmitInteraction.member as GuildMember,
        guildConfig.staffRole,
      ),
    );
    if (!validationResponse.isValid) {
      await modalSubmitInteraction.editReply(
        `Invalid submission: ${validationResponse.message}`,
      );
      return;
    }

    const user = await upsertUser(
      bot.api,
      modalSubmitInteraction.user.id,
      modalSubmitInteraction.user.username,
    );

    const response = await createEvent(eventType, submission, user._id, bot);
    if (!response) {
      await modalSubmitInteraction.editReply(
        "Something went wrong while trying to create the event :(",
      );
      return;
    }

    const eventResponse = await bot.api.events.eventsControllerFindOne({
      id: response.data._id,
    });
    if (!eventResponse) {
      await modalSubmitInteraction.editReply(
        "Something went wrong while trying fetch the event :(",
      );
      return;
    }

    const eventDoc = eventResponse.data;
    if (eventDoc.type === EventDocumentTypeEnum.BuddyRead) {
      if (!interaction.guild) return;
      const channelId = guildConfig?.brRequestChannel ?? "Not set";
      const channel = await bot.channels.fetch(channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) {
        await modalSubmitInteraction.editReply(
          "Unable to post event request in the configured channel. Please contact staff!",
        );
        return;
      }
      const embed = getEventRequestEmbed(eventDoc, modalSubmitInteraction);
      const buttonActionRow = getButtonActionRow(eventDoc._id, "er");
      const message = await channel.send({
        embeds: [embed],
        components: [buttonActionRow],
      });

      await createEventMessageDoc(
        bot,
        interaction.guild.id,
        eventDoc._id,
        message,
        "BRRequest",
      );
    }

    await modalSubmitInteraction.editReply({
      content: `Event request for ${eventDoc.book.title} successful!\n Event ID: ${eventDoc._id}`,
    });
  } catch (err) {
    const error = err as Error;
    if (error instanceof DiscordjsError) {
      await interaction.followUp({
        ephemeral: true,
        content:
          "Your request timed out! Please try again and submit the form within 5 minutes",
      });
    } else if (
      error.name === "AxiosError" &&
      error.message === "Request failed with status code 503"
    ) {
      await interaction.followUp(errors.GoodreadsIssueError);
    } else {
      await interaction.followUp(errors.SomethingWentWrongError);
      await errorHandler(
        bot,
        "commands > events > request",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  }
};

async function createEvent(
  eventType: keyof typeof EventDtoTypeEnum,
  submission: EventRequestSubmission,
  userId: string,
  bot: Bot,
) {
  const createEventDto: CreateEventDto = {
    type: eventType,
    dates: {
      startDate: new Date(submission.startDate).toISOString(),
      endDate: new Date(submission.endDate).toISOString(),
    },
    requestedBy: { user: userId, points: 0 },
    leaders: [{ user: userId, points: 0 }],
    description: submission.requestReason,
  };

  const response = await bot.api.events.eventsControllerCreateFromUrl({
    url: submission.link,
    createEventDto: createEventDto,
  });
  return response;
}

function getEventRequestModal(eventType: string, salt: number) {
  const modal = new ModalBuilder()
    .setCustomId(EVENT_REQUEST_MODAL_ID + salt)
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

  if (eventType !== EventDtoTypeEnum.MonthlyRead) {
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
    .setPlaceholder(
      "A short description of why other folks should join your event",
    )
    .setRequired(true)
    .setStyle(TextInputStyle.Paragraph);
  const reasonActionRow =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      reasonInput,
    );
  modal.addComponents(reasonActionRow);
  return modal;
}

function getEventRequestSubmission(
  interaction: ModalSubmitInteraction,
  eventType: string,
) {
  const link = interaction.fields.getTextInputValue(BOOK_LINK_FIELD_ID);
  const requestReason = interaction.fields.getTextInputValue(
    REQUEST_REASON_FIELD_ID,
  );

  if (eventType !== EventDtoTypeEnum.MonthlyRead) {
    const startDateString =
      interaction.fields.getTextInputValue(START_DATE_FIELD_ID);
    const endDateString =
      interaction.fields.getTextInputValue(END_DATE_FIELD_ID);
    return {
      link: link,
      requestReason: requestReason,
      startDate: startDateString,
      endDate: endDateString,
    };
  } else {
    const [startDate, endDate] = getNextMonthRange(new Date());
    return {
      link: link,
      requestReason: requestReason,
      startDate: startDate.toDateString(),
      endDate: endDate.toDateString(),
    };
  }
}

function isValidSubmission(request: EventRequestSubmission, isStaff: boolean) {
  const { link, startDate: startDateString, endDate: endDateString } = request;
  const startTimestamp = Date.parse(startDateString);
  if (isNaN(startTimestamp)) {
    return { isValid: false, message: "Invalid start date" };
  }
  const startDate = new Date(startTimestamp);
  if (!isStaff && startDate < new Date()) {
    return { isValid: false, message: "Start date cannot be in the past!" };
  }
  const endTimestamp = Date.parse(endDateString);
  if (isNaN(endTimestamp)) {
    return { isValid: false, message: "Invalid end date" };
  }
  const endDate = new Date(endTimestamp);
  if (endDate < startDate) {
    return {
      isValid: false,
      message: "End date cannot be before the start date!",
    };
  }
  if (!link.includes("goodreads.com/") && !link.includes("storygraph.com/")) {
    return {
      isValid: false,
      message: "Invalid link",
    };
  }
  return { isValid: true };
}

export { handleRequest };
