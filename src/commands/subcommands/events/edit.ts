import {
  EventDocument,
  EventDtoStatusEnum,
  EventDtoTypeEnum,
  UpdateEventDto,
} from "@orgbookclub/ows-client";
import {
  ButtonInteraction,
  ChannelSelectMenuBuilder,
  ChannelType,
  DiscordjsError,
  GuildMember,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { errors } from "../../../config/constants";
import { Bot, CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventInfoEmbed,
  getEventInfoStaffActionRow,
} from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";
import { hasRole, getUserByDiscordId } from "../../../utils/userUtils";

/**
 * Gives ability to edit an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleEdit: CommandHandler = async (bot, interaction, guildConfig) => {
  try {
    if (
      guildConfig &&
      interaction.member &&
      !hasRole(interaction.member as GuildMember, guildConfig.staffRole)
    ) {
      await interaction.reply({
        content: errors.StaffRestrictionError,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const field = interaction.options.getString("field", true);
    const value = interaction.options.getString("value", true);

    let eventDoc: EventDocument;
    try {
      const response = await bot.api.events.eventsControllerFindOne({ id: id });
      eventDoc = response.data;
    } catch (_error) {
      await interaction.editReply(errors.InvalidEventIdError);
      return;
    }

    const updateEventDto: UpdateEventDto = {};
    if (field === "status") {
      if (
        !Object.values(EventDtoStatusEnum).includes(
          value as keyof typeof EventDtoStatusEnum,
        )
      ) {
        await interaction.editReply({
          content:
            "Invalid event status! Input is case-sensitive, please try again",
        });
        return;
      }
      const status = value as keyof typeof EventDtoStatusEnum;
      updateEventDto.status = status;
    }
    if (field === "type") {
      if (
        !Object.values(EventDtoTypeEnum).includes(
          value as keyof typeof EventDtoTypeEnum,
        )
      ) {
        await interaction.editReply({
          content:
            "Invalid event type! Input is case-sensitive, please try again",
        });
        return;
      }
      const type = value as keyof typeof EventDtoTypeEnum;
      updateEventDto.type = type;
    }
    if (field === "dates.startDate") {
      if (isNaN(Date.parse(value))) {
        await interaction.editReply({ content: "Invalid date format!" });
        return;
      }
      const startDate = new Date(value);
      updateEventDto.dates = eventDoc.dates;
      updateEventDto.dates.startDate = startDate.toISOString();
    }
    if (field === "dates.endDate") {
      if (isNaN(Date.parse(value))) {
        await interaction.editReply({ content: "Invalid date format!" });
        return;
      }
      const endDate = new Date(value);
      updateEventDto.dates = eventDoc.dates;
      updateEventDto.dates.endDate = endDate.toISOString();
    }
    if (field === "book") {
      await interaction.editReply({
        content: "Sorry, editing this field is currently not supported :(",
      });
      return;
    }
    if (field === "threads") {
      const threads = value.split(",").map((x) => x.trim());
      updateEventDto.threads = threads;
    }
    if (field === "requestedBy") {
      const userDoc = await getUserByDiscordId(bot.api, value);
      if (!userDoc) {
        await interaction.editReply(`No user found with user Id: ${value}`);
        return;
      }
      updateEventDto.requestedBy = {
        user: userDoc._id,
        points: 0,
      };
    }
    if (field === "interested") {
      await interaction.editReply({
        content: "Sorry, editing this field is currently not supported :(",
      });
      return;
    }
    if (field === "readers") {
      await interaction.editReply({
        content: "Sorry, editing this field is currently not supported :(",
      });
      return;
    }
    if (field === "leaders") {
      await interaction.editReply({
        content: "Sorry, editing this field is currently not supported :(",
      });
      return;
    }
    if (field === "description") {
      updateEventDto.description = value;
    }
    if (field === "name") {
      updateEventDto.name = value;
    }
    const editResponse = await bot.api.events.eventsControllerUpdate({
      id: id,
      updateEventDto: updateEventDto,
    });
    await interaction.editReply({
      content: `Event \`${editResponse.data._id}\` updated`,
      embeds: [getEventInfoEmbed(editResponse.data, interaction)],
      components: actionRowOrEmpty(
        getEventInfoStaffActionRow(editResponse.data),
      ),
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > edit",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

const EVENT_EDIT_MODAL_ID = "eventEditModal";
const STATUS_FIELD_ID = "status";
const START_DATE_FIELD_ID = "startDate";
const END_DATE_FIELD_ID = "endDate";
const THREADS_FIELD_ID = "threads";
const MODAL_TIMEOUT_MS = 14 * 60 * 1000;

function toDateInputValue(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function buildEventEditModal(
  customId: string,
  eventDoc: EventDocument,
  resolvedThreadIds: string[],
) {
  const statusSelect = new StringSelectMenuBuilder()
    .setCustomId(STATUS_FIELD_ID)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      Object.values(EventDtoStatusEnum).map((s) => ({
        label: s,
        value: s,
        default: s === eventDoc.status,
      })),
    );

  const startDateInput = new TextInputBuilder()
    .setCustomId(START_DATE_FIELD_ID)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("YYYY-MM-DD")
    .setMinLength(10)
    .setMaxLength(10)
    .setValue(toDateInputValue(eventDoc.dates.startDate));

  const endDateInput = new TextInputBuilder()
    .setCustomId(END_DATE_FIELD_ID)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("YYYY-MM-DD")
    .setMinLength(10)
    .setMaxLength(10)
    .setValue(toDateInputValue(eventDoc.dates.endDate));

  const threadsSelect = new ChannelSelectMenuBuilder()
    .setCustomId(THREADS_FIELD_ID)
    .setChannelTypes(
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread,
    )
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(10);
  if (resolvedThreadIds.length > 0) {
    threadsSelect.setDefaultChannels(...resolvedThreadIds);
  }

  const storedCount = eventDoc.threads?.length ?? 0;
  const droppedCount = storedCount - resolvedThreadIds.length;
  const warning =
    droppedCount > 0
      ? `⚠️ ${droppedCount} stored thread(s) could not be resolved and won't appear below. ` +
        `Submitting this modal will **remove** those threads. ` +
        `If this happens often, use \`/events edit field:threads\` instead.`
      : null;

  const modal = new ModalBuilder().setCustomId(customId).setTitle("Edit Event");
  if (warning) {
    modal.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(warning),
    );
  }
  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("Status")
      .setStringSelectMenuComponent(statusSelect),
    new LabelBuilder()
      .setLabel("Start date")
      .setTextInputComponent(startDateInput),
    new LabelBuilder().setLabel("End date").setTextInputComponent(endDateInput),
    new LabelBuilder()
      .setLabel("Threads")
      .setChannelSelectMenuComponent(threadsSelect),
  );
  return modal;
}

async function resolveExistingThreadIds(
  bot: Bot,
  ids: string[] | null | undefined,
): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const results = await Promise.allSettled(
    ids.map((id) => bot.channels.fetch(id)),
  );
  const resolved: string[] = [];
  results.forEach((r, idx) => {
    if (r.status === "fulfilled" && r.value) {
      resolved.push(ids[idx]);
    } else {
      logger.warn(
        `Could not resolve thread ${ids[idx]} for edit modal: ${r.status === "rejected" ? r.reason : "empty result"}`,
      );
    }
  });
  return resolved;
}

/**
 * Opens the event edit modal pre-filled with the event's current values
 * (status, start/end dates, threads), then applies all changes
 * in a single update on submit. Used by the Edit button on the event info
 * card. Description is intentionally excluded from this modal; use
 * `/events edit field:description` for description-only changes.
 * Caller is responsible for the staff role check.
 *
 * @param bot The bot instance.
 * @param interaction The interaction that triggered the modal.
 * @param eventDoc The event to edit.
 */
async function showEventEditModal(
  bot: Bot,
  interaction: ButtonInteraction,
  eventDoc: EventDocument,
) {
  const salt = Math.floor(Math.random() * 1e6);
  const modalCustomId = EVENT_EDIT_MODAL_ID + salt;
  const resolvedThreadIds = await resolveExistingThreadIds(
    bot,
    eventDoc.threads,
  );
  await interaction.showModal(
    buildEventEditModal(modalCustomId, eventDoc, resolvedThreadIds),
  );

  const filter = (i: ModalSubmitInteraction) => i.customId === modalCustomId;
  let submit: ModalSubmitInteraction;
  try {
    submit = await interaction.awaitModalSubmit({
      filter,
      time: MODAL_TIMEOUT_MS,
    });
  } catch (err) {
    if (err instanceof DiscordjsError) {
      return;
    }
    throw err;
  }

  await submit.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const [status] = submit.fields.getStringSelectValues(STATUS_FIELD_ID);
    const startRaw = submit.fields.getTextInputValue(START_DATE_FIELD_ID);
    const endRaw = submit.fields.getTextInputValue(END_DATE_FIELD_ID);
    const selectedThreads =
      submit.fields
        .getSelectedChannels(THREADS_FIELD_ID, false)
        ?.map((c) => c.id) ?? [];

    const startTs = Date.parse(startRaw);
    const endTs = Date.parse(endRaw);
    if (isNaN(startTs) || isNaN(endTs)) {
      await submit.editReply("Invalid date format. Use YYYY-MM-DD.");
      return;
    }
    if (endTs < startTs) {
      await submit.editReply("End date cannot be before start date.");
      return;
    }
    if (
      !Object.values(EventDtoStatusEnum).includes(
        status as keyof typeof EventDtoStatusEnum,
      )
    ) {
      await submit.editReply("Invalid status.");
      return;
    }

    const updateEventDto: UpdateEventDto = {
      status: status as keyof typeof EventDtoStatusEnum,
      dates: {
        startDate: new Date(startTs).toISOString(),
        endDate: new Date(endTs).toISOString(),
      },
      threads: selectedThreads,
    };

    const editResponse = await bot.api.events.eventsControllerUpdate({
      id: eventDoc._id,
      updateEventDto,
    });
    await submit.editReply({
      content: `Event \`${editResponse.data._id}\` updated`,
      embeds: [getEventInfoEmbed(editResponse.data, interaction)],
      components: actionRowOrEmpty(getEventInfoStaffActionRow(editResponse.data)),
    });
  } catch (err) {
    await submit.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > edit > modal",
      err,
      interaction.guild?.name,
      undefined,
      submit,
    );
  }
}

function actionRowOrEmpty<T>(row: T | null): T[] {
  return row ? [row] : [];
}

export { handleEdit, showEventEditModal };
