import {
  EventDocumentTypeEnum,
  EventDtoTypeEnum,
} from "@orgbookclub/ows-client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { Bot, CommandHandler } from "../../../models";
import { EventRequestSubmission } from "../../../models/commands/events/EventRequestSubmission";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventRequestEmbed,
  getNextMonthRange,
} from "../../../utils/eventUtils";
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
    const modal = getEventRequestModal(eventType);
    await interaction.showModal(modal);
    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === EVENT_REQUEST_MODAL_ID;
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
      if (!channel?.isTextBased()) {
        await modalSubmitInteraction.editReply(
          "Unable to post event request in the configured channel. Please contact staff",
        );
        return;
      }
      const embed = getEventRequestEmbed(eventDoc, modalSubmitInteraction);
      const buttonActionRow = getButtonActionRow(eventDoc._id);
      await channel.send({
        embeds: [embed],
        components: [buttonActionRow],
      });
    }

    await modalSubmitInteraction.editReply({
      content: "Event request successful!",
    });
  } catch (err) {
    const error = err as Error;
    if (
      error.name === "AxiosError" &&
      error.message === "Request failed with status code 503"
    ) {
      await interaction.reply(
        "Unfortunately, due to Goodreads being Goodreads, I cannot complete your request at the moment :(" +
          "\n" +
          "Please try again later, or use Storygraph instead �",
      );
    } else {
      await errorHandler(
        bot,
        "commands > events > request",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
      await interaction.reply("Something went wrong! Please try again later");
    }
  }
};

async function createEvent(
  eventType: keyof typeof EventDtoTypeEnum,
  submission: EventRequestSubmission,
  userId: string,
  bot: Bot,
) {
  const createEventDto = {
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

function getButtonActionRow(eventId: string) {
  const interestedButton = new ButtonBuilder()
    .setLabel("Join")
    .setEmoji({ name: "✅" })
    .setStyle(ButtonStyle.Success)
    .setCustomId(`er-${eventId}-interested`);
  const notInterestedButton = new ButtonBuilder()
    .setLabel("Leave")
    .setEmoji({ name: "⛔" })
    .setStyle(ButtonStyle.Danger)
    .setCustomId(`er-${eventId}-notInterested`);
  const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    interestedButton,
    notInterestedButton,
  );
  return buttonActionRow;
}

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
