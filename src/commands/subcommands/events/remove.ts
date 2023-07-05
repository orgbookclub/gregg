import { UpdateEventDto } from "@orgbookclub/ows-client";
import { ChatInputCommandInteraction } from "discord.js";

import { Bot, CommandHandler } from "../../../models";
import { participantToDto } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

/**
 * Removes a user as a participant to an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
const handleRemove: CommandHandler = async (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => {
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
    const currentParticipantsWithoutCurrentUser = event[participantType].filter(
      (x) => x.user.userId !== user.id,
    );
    const updateEventDto: UpdateEventDto = {};

    updateEventDto[participantType] = currentParticipantsWithoutCurrentUser.map(
      (x) => participantToDto(x),
    );
    bot.emit("eventEdit", {
      id: id,
      updateEventDto: updateEventDto,
    });

    await interaction.editReply({
      content: "Your event edit request has been submitted!",
    });
  } catch (error) {
    logger.error(error, "Error in handleRemove");
  }
};

export { handleRemove };
