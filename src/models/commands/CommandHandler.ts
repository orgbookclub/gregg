import { GuildsConfig } from "@prisma/client";
import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "..";

export type CommandHandler = (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
  guildConfig?: GuildsConfig,
) => Promise<void>;
