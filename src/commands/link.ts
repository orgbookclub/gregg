import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import { Command } from "../models";
import { EngineError } from "../modules/engine/client";
import { pushRoleCatalog } from "../modules/engine/service";
import { errorHandler } from "../utils/errorHandler";
import { logger } from "../utils/logHandler";

const CLAIM_ERRORS: Record<number, string> = {
  404: "That link code doesn't exist. Create a new one in the club's web settings.",
  409: "This server is already linked to a club.",
  422: "That link code has expired, was already used, or was created for another platform. Create a new one.",
};

export const link: Command = {
  backends: ["engine"],
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Links this server to a club using a code from the web app")
    .addStringOption((option) =>
      option
        .setName("code")
        .setDescription("The link code from the club's integration settings")
        .setMinLength(4)
        .setMaxLength(32)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild),
  run: async (bot, interaction) => {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const guild = interaction.guild;
      if (!bot.engine || !guild) {
        await interaction.editReply("Linking needs `BACKEND=engine`.");
        return;
      }
      const existing = await bot.engine.forGuild(guild.id);
      if (existing) {
        const { club } = await existing.getClub();
        await interaction.editReply(
          `This server is already linked to **${club.name}**.`,
        );
        return;
      }
      const code = interaction.options.getString("code", true);
      try {
        await bot.engine.client.claimInstallation(code, guild.id, guild.name);
      } catch (error) {
        const message =
          error instanceof EngineError ? CLAIM_ERRORS[error.status] : undefined;
        if (!message) throw error;
        await interaction.editReply(message);
        return;
      }
      const client = await bot.engine.forGuild(guild.id);
      if (!client) {
        await interaction.editReply(
          "The link was created but the installation isn't active. Check the club's integration settings.",
        );
        return;
      }
      try {
        await pushRoleCatalog(guild, client);
      } catch (error) {
        logger.warn(
          { err: error },
          `Role catalogue push failed for ${guild.id}`,
        );
      }
      const { club } = await client.getClub();
      await interaction.editReply(
        `Linked this server to **${club.name}**. Club admins can now map Discord roles to club roles in the web app's integration settings.`,
      );
    } catch (err) {
      await interaction.editReply("Linking failed. Please try again later.");
      await errorHandler(
        bot,
        "commands > link",
        err,
        interaction.guild?.name,
        undefined,
        interaction,
      );
    }
  },
};
