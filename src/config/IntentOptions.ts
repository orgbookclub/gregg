import { GatewayIntentBits } from "discord.js";

/**
 * This contains the list of Intent options the bot requests on identify.
 */
export const IntentOptions = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.DirectMessages,
];
