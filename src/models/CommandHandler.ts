import { ChatInputCommandInteraction } from "discord.js";

import { Bot } from "./Bot";

export type CommandHandler = (
  Becca: Bot,
  interaction: ChatInputCommandInteraction,
) => Promise<void>;
