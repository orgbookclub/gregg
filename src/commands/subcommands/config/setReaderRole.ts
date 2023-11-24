import { GuildMember } from "discord.js";

import { CommandHandler } from "../../../models";
import { errorHandler } from "../../../utils/errorHandler";
import { hasRole } from "../../../utils/userUtils";

/**
 * Sets the reader role, along with the points in the guild config.
 *
 * @param bot The bot.
 * @param interaction The interaction.
 * @param guildConfig The guild config.
 */
const handleSetReaderRole: CommandHandler = async (
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
        content: "Sorry, this command is restricted for staff use only!",
        ephemeral: true,
      });
      return;
    }
    await interaction.deferReply();
    if (!interaction.guild) {
      await interaction.editReply("Something went wrong!");
      return;
    }

    const guild = interaction.guild;
    const role = interaction.options.getRole("role", true);
    const points = interaction.options.getInteger("points", true);

    const newEntry = {
      role: role.id,
      points: points,
    };

    const readerRoles = guildConfig?.readerRoles ?? [];
    const existingEntryIndex = readerRoles.findIndex(
      (elem) => elem.role === role.id,
    );
    if (existingEntryIndex !== -1) {
      readerRoles[existingEntryIndex] = newEntry;
    } else {
      readerRoles.push(newEntry);
    }
    await bot.db.guilds.upsert({
      where: {
        guildId: interaction.guild.id,
      },
      update: {
        config: {
          readerRoles: readerRoles,
          ...guildConfig,
        },
      },
      create: {
        guildId: guild.id,
        name: guild.name,
        ownerId: guild.ownerId,
        region: guild.preferredLocale,
        createdAt: guild.createdAt,
        joinedAt: guild.joinedAt,
        config: {
          readerRoles: readerRoles,
        },
      },
    });
    await interaction.editReply("Guild Config Updated");
  } catch (err) {
    await interaction.editReply("Something went wrong! Please try again later");
    await errorHandler(
      bot,
      "commands > config > setReaderRole",
      err,
      interaction.guild?.name,
      undefined,
      interaction,
    );
  }
};

export { handleSetReaderRole };
