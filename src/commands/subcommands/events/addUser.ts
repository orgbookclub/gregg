import { EventDocument, UpdateEventDto } from "@orgbookclub/ows-client";
import { GuildMember } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import {
  participantToDto,
  hasRole,
  upsertUser,
} from "../../../utils/userUtils";

/**
 * Adds a user as a participant to an event.
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
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const user = interaction.options.getUser("user", true);
    const participantType = interaction.options.getString("type", true);
    const points = interaction.options.getInteger("points") ?? 5;

    if (
      participantType !== "readers" &&
      participantType !== "leaders" &&
      participantType !== "interested"
    ) {
      return;
    }

    let eventDoc: EventDocument;
    try {
      const response = await bot.api.events.eventsControllerFindOne({ id: id });
      eventDoc = response.data;
    } catch (_error) {
      await interaction.editReply(errors.InvalidEventIdError);
      return;
    }

    const userDoc = await upsertUser(bot.api, user.id, user.username);

    const allParticipants = eventDoc[participantType];
    const participantsWithoutCurrentUser = allParticipants.filter(
      (x) => x.user.userId !== user.id,
    );

    const updateEventDto: UpdateEventDto = {};
    const currParticipantDto = {
      user: userDoc._id,
      points: points,
    };
    updateEventDto[participantType] = [
      ...participantsWithoutCurrentUser.map((x) => participantToDto(x)),
      currParticipantDto,
    ];

    const updatedResponse = await bot.api.events.eventsControllerUpdate({
      id: id,
      updateEventDto: updateEventDto,
    });
    await interaction.editReply({
      content: `Added user ${user.username} to event ${updatedResponse.data._id}!`,
      embeds: [getEventInfoEmbed(updatedResponse.data, interaction)],
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
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

export { handleAddUser };
