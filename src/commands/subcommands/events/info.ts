import { EventDocument } from "@orgbookclub/ows-client";
import { GuildMember } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import {
  getEventInfoEmbed,
  getEventInfoStaffActionRow,
} from "../../../utils/eventUtils";
import { hasRole } from "../../../utils/userUtils";

/**
 * Shows detailed information for an event.
 *
 * @param bot The bot instance.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
export const handleInfo: CommandHandler = async (
  bot,
  interaction,
  guildConfig,
) => {
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

    const isStaff =
      !!guildConfig &&
      !!interaction.member &&
      hasRole(interaction.member as GuildMember, guildConfig.staffRole);

    const embed = getEventInfoEmbed(eventDoc, interaction);
    const actionRow = isStaff ? getEventInfoStaffActionRow(eventDoc) : null;
    await interaction.editReply({
      embeds: [embed],
      components: actionRow ? [actionRow] : [],
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
