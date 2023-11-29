import { EventDocument, UpdateEventDto } from "@orgbookclub/ows-client";
import { GuildMember } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import { participantToDto, hasRole } from "../../../utils/userUtils";

/**
 * Removes a user as a participant to an event.
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
    await interaction.deferReply();
    const id = interaction.options.getString("id", true);
    const user = interaction.options.getUser("user", true);
    const participantType = interaction.options.getString("type", true);

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
    } catch (error) {
      await interaction.editReply(errors.InvalidEventIdError);
      return;
    }

    const participantsWithoutCurrentUser = eventDoc[participantType].filter(
      (x) => x.user.userId !== user.id,
    );
    const updateEventDto: UpdateEventDto = {};

    updateEventDto[participantType] = participantsWithoutCurrentUser.map((x) =>
      participantToDto(x),
    );
    const updatedResponse = await bot.api.events.eventsControllerUpdate({
      id: id,
      updateEventDto: updateEventDto,
    });
    await interaction.editReply({
      content: "Removed user from event!",
      embeds: [getEventInfoEmbed(updatedResponse.data, interaction)],
    });
  } catch (err) {
    await interaction.reply(errors.SomethingWentWrongError);
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

export { handleRemoveUser };
