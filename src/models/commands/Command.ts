import { GuildsConfig } from "@prisma/client";
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

import { Bot } from "..";
import { BackendScoped } from "../../modules/engine/backend";

export interface Command extends BackendScoped {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder;
  run: (
    bot: Bot,
    interaction: ChatInputCommandInteraction,
    guildConfig?: GuildsConfig,
  ) => Promise<void>;
  cooldown?: number;
}
