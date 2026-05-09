import { EventDocument, UpdateEventDto } from "@orgbookclub/ows-client";
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
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
  UserSelectMenuBuilder,
} from "discord.js";

import { errors } from "../../../config/constants";
import {
  EventParticipantOptions,
  isParticipantType,
} from "../../../config/EventParticipantOptions";
import { Bot, CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventInfoEmbed,
  getEventInfoStaffActionRow,
} from "../../../utils/eventUtils";
import {
  hasRole,
  participantToDto,
  upsertUser,
} from "../../../utils/userUtils";

const EVENT_ADDUSER_MODAL_ID = "eventAddUserModal";
const USERS_FIELD_ID = "users";
const TYPE_FIELD_ID = "type";
const POINTS_FIELD_ID = "points";
const DEFAULT_POINTS = 5;
const MAX_POINTS = 100;
const MAX_USERS_PER_BATCH = 25;
const MODAL_TIMEOUT_MS = 14 * 60 * 1000;

/**
 * Opens a modal allowing staff to add up to 25 users as event participants
 * in a single submission, with selectable participant type and shared points.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleAddUser: CommandHandler = async (bot, interaction, guildConfig) => {
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
    const id = interaction.options.getString("id", true);
    await runAddUserFlow(bot, interaction, id);
  } catch (err) {
    await errorHandler(
      bot,
      "commands > events > addUser",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

/**
 * Shows the addUser modal pre-populated for the given event id and processes
 * the submission. Shared between the slash command and the Add Points button
 * on the event info card. Caller is responsible for the staff role check.
 *
 * @param bot The bot instance.
 * @param interaction The interaction (slash command or button).
 * @param eventId The event id.
 */
async function runAddUserFlow(
  bot: Bot,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  eventId: string,
) {
  let modalSubmit: ModalSubmitInteraction | undefined;
  try {
    const salt = Math.random() * 100;
    const modalCustomId = EVENT_ADDUSER_MODAL_ID + salt;
    await interaction.showModal(getAddUserModal(modalCustomId, eventId));

    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === modalCustomId;
    modalSubmit = await interaction.awaitModalSubmit({
      filter,
      time: MODAL_TIMEOUT_MS,
    });
    await modalSubmit.deferReply();

    let eventDoc: EventDocument;
    try {
      const response = await bot.api.events.eventsControllerFindOne({
        id: eventId,
      });
      eventDoc = response.data;
    } catch (_error) {
      await modalSubmit.editReply(errors.InvalidEventIdError);
      return;
    }

    const [participantType] =
      modalSubmit.fields.getStringSelectValues(TYPE_FIELD_ID);
    if (!isParticipantType(participantType)) {
      await modalSubmit.editReply("Invalid participant type.");
      return;
    }

    const points = parsePoints(
      modalSubmit.fields.getTextInputValue(POINTS_FIELD_ID),
    );
    if (points === null) {
      await modalSubmit.editReply(
        `Invalid points value. Please enter an integer between 0 and ${MAX_POINTS}.`,
      );
      return;
    }

    const selectedUsers = modalSubmit.fields.getSelectedUsers(
      USERS_FIELD_ID,
      true,
    );
    const userDocs = await Promise.all(
      selectedUsers.map((user) => upsertUser(bot.api, user.id, user.username)),
    );

    const selectedUserIds = new Set(selectedUsers.map((user) => user.id));
    const remaining = eventDoc[participantType].filter(
      (x) => !selectedUserIds.has(x.user.userId),
    );

    const updateEventDto: UpdateEventDto = {};
    updateEventDto[participantType] = [
      ...remaining.map((x) => participantToDto(x)),
      ...userDocs.map((doc) => ({ user: doc._id, points })),
    ];

    const updateResponse = await bot.api.events.eventsControllerUpdate({
      id: eventId,
      updateEventDto: updateEventDto,
    });

    const usernames = selectedUsers.map((user) => user.username).join(", ");
    const row = getEventInfoStaffActionRow(updateResponse.data);
    await modalSubmit.editReply({
      content: `Added ${selectedUsers.size} user(s) to event \`${updateResponse.data._id}\` as ${participantType} (${points} pts): ${usernames}`,
      embeds: [getEventInfoEmbed(updateResponse.data, interaction)],
      components: row ? [row] : [],
    });
  } catch (err) {
    await respondToAddUserError(err, interaction, modalSubmit);
    throw err;
  }
}

async function respondToAddUserError(
  err: unknown,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  modalSubmit: ModalSubmitInteraction | undefined,
) {
  const timeoutMsg =
    "Your request timed out! Please try again and submit the form within 14 minutes.";
  if (err instanceof DiscordjsError) {
    if (modalSubmit) {
      if (modalSubmit.deferred || modalSubmit.replied) {
        await modalSubmit.editReply(timeoutMsg);
      } else {
        await modalSubmit.reply({
          content: timeoutMsg,
          flags: MessageFlags.Ephemeral,
        });
      }
    } else {
      await interaction.followUp({
        content: timeoutMsg,
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }
  if (modalSubmit) {
    if (modalSubmit.deferred || modalSubmit.replied) {
      await modalSubmit.editReply(errors.SomethingWentWrongError);
    } else {
      await modalSubmit.reply({
        content: errors.SomethingWentWrongError,
        flags: MessageFlags.Ephemeral,
      });
    }
  } else {
    await interaction.followUp(errors.SomethingWentWrongError);
  }
}

function parsePoints(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return DEFAULT_POINTS;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_POINTS) {
    return null;
  }
  return parsed;
}

function getAddUserModal(customId: string, eventId: string) {
  const usersSelect = new UserSelectMenuBuilder()
    .setCustomId(USERS_FIELD_ID)
    .setPlaceholder("Pick up to 25 users")
    .setMinValues(1)
    .setMaxValues(MAX_USERS_PER_BATCH);

  const typeSelect = new StringSelectMenuBuilder()
    .setCustomId(TYPE_FIELD_ID)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      EventParticipantOptions.map((opt) => ({
        label: opt.name,
        value: opt.value,
        default: opt.value === "readers",
      })),
    );

  const pointsInput = new TextInputBuilder()
    .setCustomId(POINTS_FIELD_ID)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setValue(String(DEFAULT_POINTS))
    .setPlaceholder(`0-${MAX_POINTS}`);

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle("Add participants")
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Event ID:** \`${eventId}\``),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Users to add")
        .setUserSelectMenuComponent(usersSelect),
      new LabelBuilder()
        .setLabel("Participant type")
        .setStringSelectMenuComponent(typeSelect),
      new LabelBuilder()
        .setLabel(`Points (default ${DEFAULT_POINTS})`)
        .setTextInputComponent(pointsInput),
    );
}

export { handleAddUser, runAddUserFlow };
