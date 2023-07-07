import { CommandHandler } from "../../../models";
import { getEventInfoEmbed } from "../../../utils/eventUtils";
import { logger } from "../../../utils/logHandler";

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
    const response = await bot.api.events.eventsControllerFindOne({
      id: eventId,
    });
    const embed = getEventInfoEmbed(response.data, interaction);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch (err) {
    logger.error(err, `Error in handleInfo`);
    await interaction.editReply("Something went wrong! Please try again later");
  }
};
