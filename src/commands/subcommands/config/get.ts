import { GuildMember } from "discord.js";

import { errors } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { hasRole } from "../../../utils/userUtils";

/**
 * Gets the current guild config for the guild.
 *
 * @param bot The bot.
 * @param interaction The interaction.
 * @param guildConfig The guildConfig.
 */
export const handleGet: CommandHandler = async (
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
    const prettyConfig = JSON.stringify(guildConfig, null, 2);
    await interaction.reply(`\`\`\`json\n${prettyConfig}\`\`\``);
  } catch (error) {
    await errorHandler(
      bot,
      "commands > config > get",
      error,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};
