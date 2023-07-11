import { GuildsConfig } from "@prisma/client";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

import { Bot } from "..";

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  run: (
    bot: Bot,
    interaction: ChatInputCommandInteraction,
    guildConfig?: GuildsConfig,
  ) => Promise<void>;
  cooldown?: number;
}
