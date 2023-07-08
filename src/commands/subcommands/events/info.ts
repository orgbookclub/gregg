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
    const response = await bot.api.events.eventsControllerFindOne({
      id: eventId,
    });
    const embed = getEventInfoEmbed(response.data, interaction);
    await interaction.editReply({
      embeds: [embed],
    });
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    errorHandler(
      bot,
      "commands > events > info",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
