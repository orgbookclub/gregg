import { EventDocument } from "@orgbookclub/ows-client";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { getEventInfoEmbed } from "../../../utils/eventUtils";

/**
 * Shows detailed information for an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 */
export const handleInfo: CommandHandler = async (bot, interaction) => {
  try {
    await interaction.deferReply();
    const eventId = interaction.options.getString("id", true);

    let eventDoc: EventDocument;
    try {
      const response = await bot.api.events.eventsControllerFindOne({
        id: eventId,
      });
      eventDoc = response.data;
    } catch (_error) {
      await interaction.editReply(errors.InvalidEventIdError);
      return;
    }

    const embed = getEventInfoEmbed(eventDoc, interaction);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > events > info",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
