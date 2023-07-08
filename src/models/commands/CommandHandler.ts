import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "..";

export type CommandHandler = (
  bot: Bot,
  interaction: ChatInputCommandInteraction,
) => Promise<void>;
