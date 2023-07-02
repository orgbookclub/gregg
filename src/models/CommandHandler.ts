import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from ".";

export type CommandHandler = (
  Becca: Bot,
  interaction: ChatInputCommandInteraction,
) => Promise<void>;
