import {
  ChatInputCommandInteraction,
  Role,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

import { Bot } from "..";

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  run: (bot: Bot, interaction: ChatInputCommandInteraction) => Promise<void>;
  cooldown?: number;
  requiredRoles?: Role[];
}
