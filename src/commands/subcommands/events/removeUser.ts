import { UpdateEventDto } from "@orgbookclub/ows-client";

import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventInfoEmbed, participantToDto } from "../../../utils/eventUtils";

/**
 * Removes a user as a participant to an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleRemoveUser: CommandHandler = async (bot, interaction) => {
  try {
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

    const response = await bot.api.events.eventsControllerFindOne({ id: id });
    if (!response) {
      await interaction.editReply({
        content: "Invalid event ID! Please try again with a valid event ID.",
      });
      return;
    }
    const event = response.data;
    const participantsWithoutCurrentUser = event[participantType].filter(
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
    await interaction.reply("Something went wrong! Please try again later");
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
