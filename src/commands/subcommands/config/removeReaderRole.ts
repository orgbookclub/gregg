import { GuildMember, MessageFlags, roleMention } from "discord.js";

import { errors, messages } from "../../../config/constants";
import { CommandHandler } from "../../../models";
import { logConfigChange } from "../../../utils/configLogger";
import { errorHandler } from "../../../utils/errorHandler";
import { hasRole } from "../../../utils/userUtils";

/**
 * Removes a reader role entry from the guild config. The role itself is
 * not deleted from Discord — only the threshold mapping in config.
 *
 * @param bot The bot.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleRemoveReaderRole: CommandHandler = async (
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
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferReply();
    if (!interaction.guild) {
      await interaction.editReply(errors.SomethingWentWrongError);
      return;
    }

    const role = interaction.options.getRole("role", true);

    const readerRoles = guildConfig?.readerRoles ?? [];
    const existingEntry = readerRoles.find((elem) => elem.role === role.id);
    if (!existingEntry) {
      await interaction.editReply(
        `No reader role entry found for ${roleMention(role.id)}. Nothing to remove.`,
      );
      return;
    }
    const filtered = readerRoles.filter((elem) => elem.role !== role.id);

    await bot.db.guilds.update({
      where: {
        guildId: interaction.guild.id,
      },
      data: {
        config: {
          ...guildConfig,
          readerRoles: filtered,
        },
      },
    });
    await logConfigChange(guildConfig?.logWebhookUrl ?? "", interaction.user, [
      {
        field: `readerRoles ${roleMention(role.id)}`,
        oldValue: `${existingEntry.points} pts, ${existingEntry.window}`,
        newValue: "(removed)",
      },
    ]);
    await interaction.editReply(messages.GuildConfigUpdated);
  } catch (err) {
    await interaction.editReply(errors.SomethingWentWrongError);
    await errorHandler(
      bot,
      "commands > config > removeReaderRole",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

export { handleRemoveReaderRole };
