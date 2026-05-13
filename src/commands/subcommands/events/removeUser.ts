import { EventDocument, UpdateEventDto } from "@organizedbookclub/ows-client";
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
  UserSelectMenuBuilder,
} from "discord.js";

import { errors, templates } from "../../../config/constants";
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
import { hasRole, participantToDto } from "../../../utils/userUtils";

const EVENT_REMOVEUSER_MODAL_ID = "eventRemoveUserModal";
const USERS_FIELD_ID = "users";
const TYPE_FIELD_ID = "type";
const MAX_USERS_PER_BATCH = 25;
const MODAL_TIMEOUT_MS = 14 * 60 * 1000;

/**
 * Opens a modal allowing staff to remove up to 25 users as event participants
 * in a single submission.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleRemoveUser: CommandHandler = async (
  bot,
  interaction,
  guildConfig,
) => {
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
    await runRemoveUserFlow(bot, interaction, id);
  } catch (err) {
    await errorHandler(
      bot,
      "commands > events > removeUser",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

/**
 * Shows the removeUser modal pre-populated for the given event id and
 * processes the submission. Shared between the slash command and the Remove
 * Points button on the event info card. Caller is responsible for the staff
 * role check.
 *
 * @param bot The bot instance.
 * @param interaction The interaction (slash command or button).
 * @param eventId The event id.
 */
async function runRemoveUserFlow(
  bot: Bot,
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  eventId: string,
) {
  let modalSubmit: ModalSubmitInteraction | undefined;
  try {
    const salt = Math.random() * 100;
    const modalCustomId = EVENT_REMOVEUSER_MODAL_ID + salt;
    await interaction.showModal(getRemoveUserModal(modalCustomId, eventId));

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
      await modalSubmit.editReply(errors.EventNotFoundError);
      return;
    }

    const [participantType] =
      modalSubmit.fields.getStringSelectValues(TYPE_FIELD_ID);
    if (!isParticipantType(participantType)) {
      await modalSubmit.editReply(errors.InvalidParticipantTypeError);
      return;
    }

    const selectedUsers = modalSubmit.fields.getSelectedUsers(
      USERS_FIELD_ID,
      true,
    );
    const selectedUserIds = new Set(selectedUsers.map((user) => user.id));

    const currentList = eventDoc[participantType];
    const remaining = currentList.filter(
      (x) => !selectedUserIds.has(x.user.userId),
    );
    const removedCount = currentList.length - remaining.length;

    if (removedCount === 0) {
      await modalSubmit.editReply(
        `No changes made. None of the selected user(s) were listed as ${participantType} for this event.`,
      );
      return;
    }

    const updateEventDto: UpdateEventDto = {};
    updateEventDto[participantType] = remaining.map((x) => participantToDto(x));

    const updateResponse = await bot.api.events.eventsControllerUpdate({
      id: eventId,
      updateEventDto: updateEventDto,
    });

    const removedUsernames = selectedUsers
      .filter((user) => currentList.some((x) => x.user.userId === user.id))
      .map((user) => user.username)
      .join(", ");
    const notListedCount = selectedUsers.size - removedCount;
    const notListedSuffix =
      notListedCount > 0
        ? templates.participantsNotListedSuffix(notListedCount)
        : "";

    const row = getEventInfoStaffActionRow(updateResponse.data);
    await modalSubmit.editReply({
      content: templates.participantsRemoved(
        removedCount,
        updateResponse.data._id,
        participantType,
        removedUsernames,
        notListedSuffix,
      ),
      embeds: [getEventInfoEmbed(updateResponse.data, interaction)],
      components: row ? [row] : [],
    });
  } catch (err) {
    const timeoutMsg = templates.modalTimeout(14);
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
    throw err;
  }
}

function getRemoveUserModal(customId: string, eventId: string) {
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

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle("Remove participants")
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Event ID:** \`${eventId}\``),
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Users to remove")
        .setUserSelectMenuComponent(usersSelect),
      new LabelBuilder()
        .setLabel("Participant type")
        .setStringSelectMenuComponent(typeSelect),
    );
}

export { handleRemoveUser, runRemoveUserFlow };
