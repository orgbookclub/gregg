import {
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
} from "discord.js";

import { Bot } from ".";

export interface Context {
  data: ContextMenuCommandBuilder;

  run: (bot: Bot, interaction: ContextMenuCommandInteraction) => Promise<void>;
  cooldown?: number;
}
