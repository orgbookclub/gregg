import { EventDocument, UpdateEventDto } from "@orgbookclub/ows-client";
import {
  DiscordjsError,
  GuildMember,
  LabelBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  UserSelectMenuBuilder,
} from "discord.js";

import { errors } from "../../../config/constants";
import {
  EventParticipantOptions,
  isParticipantType,
} from "../../../config/EventParticipantOptions";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
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
        ephemeral: true,
      });
      return;
    }

    const id = interaction.options.getString("id", true);
    const salt = Math.random() * 100;
    const modalCustomId = EVENT_REMOVEUSER_MODAL_ID + salt;
    await interaction.showModal(getRemoveUserModal(modalCustomId, id));

    const filter = (msInteraction: ModalSubmitInteraction) =>
      msInteraction.customId === modalCustomId;
    const modalSubmit = await interaction.awaitModalSubmit({
      filter,
      time: MODAL_TIMEOUT_MS,
    });
    await modalSubmit.deferReply();

    let eventDoc: EventDocument;
    try {
      const response = await bot.api.events.eventsControllerFindOne({ id });
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
      id,
      updateEventDto: updateEventDto,
    });

    const removedUsernames = selectedUsers
      .filter((user) => currentList.some((x) => x.user.userId === user.id))
      .map((user) => user.username)
      .join(", ");
    const notListedCount = selectedUsers.size - removedCount;
    const notListedSuffix =
      notListedCount > 0
        ? ` (${notListedCount} selected user(s) were not on the list)`
        : "";

    await modalSubmit.editReply({
      content: `Removed ${removedCount} user(s) from event ${updateResponse.data._id} as ${participantType}: ${removedUsernames}${notListedSuffix}`,
      embeds: [getEventInfoEmbed(updateResponse.data, interaction)],
    });
  } catch (err) {
    if (err instanceof DiscordjsError) {
      await interaction.followUp({
        content:
          "Your request timed out! Please try again and submit the form within 14 minutes.",
        ephemeral: true,
      });
      return;
    }
    await interaction.followUp(errors.SomethingWentWrongError);
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

export { handleRemoveUser };
