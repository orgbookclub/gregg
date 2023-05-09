import { Bot } from "./models/Bot";
import { logger } from "./utils/logHandler";

/**
 * Validates that all expected environment variables are set with *some* value.
 * Does not validate that the values are valid. Constructs a config object and
 * attaches it to the bot instance.
 *
 * @param bot The bot instance.
 * @returns Object containing a valid property as boolean, and a message as string.
 */
export const validateEnv = (bot: Bot): { valid: boolean; message: string } => {
  try {
    if (!process.env.BOT_TOKEN) {
      return { valid: false, message: "Missing Discord token" };
    }
    if (!process.env.CLIENT_ID) {
      return { valid: false, message: "Missing Bot's Client ID" };
    }
    if (!process.env.HOME_GUILD_ID) {
      return { valid: false, message: "Missing Bot's Home Guild ID" };
    }
    if (!process.env.OWS_URL) {
      return { valid: false, message: "Missing OWS Url" };
    }
    if (!process.env.CLIENT_SECRET) {
      return { valid: false, message: "Missing Bot's Client secret" };
    }

    const configs: Bot["configs"] = {
      token: process.env.BOT_TOKEN,
      clientId: process.env.CLIENT_ID,
      homeGuildId: process.env.HOME_GUILD_ID,
      owsUrl: process.env.OWS_URL,
      clientSecret: process.env.CLIENT_SECRET,
    };

    bot.configs = configs;
    return { valid: true, message: "Environment variables validated!" };
  } catch (err) {
    logger.error("Unknown error while validating environment");
    return {
      valid: false,
      message: "Unknown error while validating environment",
    };
  }
};
