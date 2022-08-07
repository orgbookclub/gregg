import {
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
} from "discord.js";

import { Bot } from "./Bot";

export interface Context {
  data: ContextMenuCommandBuilder;

  run: (bot: Bot, interaction: ContextMenuCommandInteraction) => Promise<void>;
}
